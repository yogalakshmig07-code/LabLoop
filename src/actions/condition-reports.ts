"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ConditionReportCreateSchema } from "@/lib/validations";
import { transitionBooking } from "@/lib/workflow";
import { requireUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function submitConditionReport(rawInput: unknown) {
  const session = await requireUser();

  const parseResult = ConditionReportCreateSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.errors.map((e) => e.message).join(", ") };
  }

  const input = parseResult.data;
  const adminSupabase = createAdminClient();

  const { data: booking, error: bErr } = await adminSupabase
    .from("bookings")
    .select("id, resource_id, user_id, status")
    .eq("id", input.booking_id)
    .single();

  if (bErr || !booking) {
    return { success: false, error: "Booking not found." };
  }

  // Insert condition report
  const { data: report, error: reportErr } = await adminSupabase
    .from("condition_reports")
    .insert({
      booking_id: input.booking_id,
      kind: input.kind,
      grade: input.grade,
      notes: input.notes,
      checklist: input.checklist,
      photo_paths: input.photo_paths,
      recorded_by: session.user.id,
    })
    .select("id")
    .single();

  if (reportErr) {
    return { success: false, error: reportErr.message };
  }

  // Transition booking status through workflow state machine
  const targetStatus = input.kind === "checkout" ? "checked_out" : "returned";
  const transitionResult = await transitionBooking(
    input.booking_id,
    targetStatus,
    {
      id: session.user.id,
      name: session.profile.full_name || session.user.email || undefined,
      role: session.role,
    },
    `Condition report recorded (${input.kind}): Grade ${input.grade}. ${input.notes || ""}`,
    {
      [`${input.kind === "checkout" ? "checked_out_at" : "returned_at"}`]: new Date().toISOString(),
    }
  );

  if (!transitionResult.ok) {
    return { success: false, error: transitionResult.error };
  }

  // Audit log condition report
  await logAudit({
    actor: {
      id: session.user.id,
      name: session.profile.full_name || session.user.email,
    },
    action: `CONDITION_REPORT_${input.kind.toUpperCase()}`,
    entityType: "condition_report",
    entityId: report.id,
    bookingId: booking.id,
    resourceId: booking.resource_id,
    reason: `Grade assigned: ${input.grade}`,
    details: { grade: input.grade, kind: input.kind, checklist: input.checklist },
  });

  revalidatePath(`/bookings/${input.booking_id}`);
  revalidatePath("/handovers");
  return { success: true, reportId: report.id };
}
