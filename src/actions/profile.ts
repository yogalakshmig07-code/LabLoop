"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { ActionResult } from "@/types/actions";
import { revalidatePath } from "next/cache";

export async function updateProfileAction(data: {
  full_name: string;
  department: string;
}): Promise<ActionResult<void>> {
  try {
    const session = await requireUser();
    const admin = createAdminClient();

    const fullName = data.full_name?.trim();
    const department = data.department?.trim();

    if (!fullName) {
      return { ok: false, error: "Full name cannot be blank." };
    }

    const { error } = await admin
      .from("profiles")
      .update({
        full_name: fullName,
        department: department || null,
      })
      .eq("id", session.user.id);

    if (error) {
      return { ok: false, error: error.message };
    }

    await logAudit({
      actor: { id: session.user.id, name: fullName },
      action: "profile_updated",
      entityType: "profile",
      entityId: session.user.id,
      reason: "User updated their account profile details",
      details: { full_name: fullName, department },
    });

    revalidatePath("/profile");
    return { ok: true, data: undefined };
  } catch (err: any) {
    console.error("Error in updateProfileAction:", err);
    return { ok: false, error: err?.message || "Failed to update profile" };
  }
}

