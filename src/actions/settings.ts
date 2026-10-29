"use server";

import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // In standalone test environments, static generation store is not active
  }
}

const FairnessSettingsSchema = z.object({
  max_active_bookings: z.coerce.number().int().min(1, "Max active bookings must be at least 1").max(20, "Max active bookings cannot exceed 20"),
  max_hours_per_week_per_category: z.coerce.number().int().min(1, "Weekly category cap must be at least 1 hour").max(168, "Weekly cap cannot exceed 168 hours"),
  strike_threshold: z.coerce.number().int().min(1, "Strike threshold must be at least 1").max(10, "Strike threshold cannot exceed 10"),
  reminder_minutes_before: z.coerce.number().int().min(5, "Reminder lead time must be at least 5 minutes").max(1440, "Reminder lead time cannot exceed 24 hours (1440m)"),
});

export type FairnessSettingsInput = z.infer<typeof FairnessSettingsSchema>;

export interface ActionResult<T = void> {
  ok: boolean;
  error?: string;
  data?: T;
}

export async function updateFairnessSettingsAction(
  input: FairnessSettingsInput
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const session = await requireRole(["admin"]);
    const parsed = FairnessSettingsSchema.safeParse(input);

    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message || "Invalid settings input",
      };
    }

    const admin = createAdminClient();

    // Fetch existing settings to log delta in audit
    const { data: previousSettings } = await admin
      .from("fairness_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    const { error: updateError } = await admin
      .from("fairness_settings")
      .update({
        max_active_bookings: parsed.data.max_active_bookings,
        max_hours_per_week_per_category: parsed.data.max_hours_per_week_per_category,
        strike_threshold: parsed.data.strike_threshold,
        reminder_minutes_before: parsed.data.reminder_minutes_before,
      })
      .eq("id", 1);

    if (updateError) {
      return { ok: false, error: updateError.message };
    }

    // Log Immutable Audit Trail
    await logAudit({
      actor: {
        id: session.user.id,
        name: session.profile.full_name || "Admin",
      },
      action: "fairness_settings_updated",
      entityType: "fairness_settings",
      entityId: "1",
      reason: `Admin updated campus fairness quotas (Max active: ${parsed.data.max_active_bookings}, Weekly cap: ${parsed.data.max_hours_per_week_per_category}h, Strike limit: ${parsed.data.strike_threshold})`,
      details: {
        previous: previousSettings || {},
        updated: parsed.data,
      },
    });

    safeRevalidate("/admin/settings");
    safeRevalidate("/fairness-settings");
    safeRevalidate("/dashboard");
    safeRevalidate("/resources");

    return { ok: true, data: { success: true } };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to update fairness settings" };
  }
}

