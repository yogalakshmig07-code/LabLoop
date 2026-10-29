"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, requireUser } from "@/lib/session";
import { transitionBooking } from "@/lib/workflow";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { checkOverdueAndReminders, OverdueCheckResult } from "@/lib/overdue";
import { ConditionGrade } from "@/types/db";
import { ActionResult } from "@/types/actions";
import { revalidatePath } from "next/cache";

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

/**
 * Manually executes the overdue and reminder monitor routine.
 */
export async function runOverdueCheckAction(): Promise<ActionResult<OverdueCheckResult>> {
  try {
    await requireRole(["owner", "manager", "admin"]);
    const result = await checkOverdueAndReminders(true);
    revalidatePath("/handovers");
    revalidatePath("/bookings");
    return { ok: true, data: result };
  } catch (err: any) {
    console.error("runOverdueCheckAction error:", err);
    return { ok: false, error: err?.message || "Failed to run overdue monitor." };
  }
}

/**
 * Completes the physical check-out inspection for an approved reservation.
 */
export async function submitCheckoutReportAction(
  formData: FormData
): Promise<ActionResult<{ reportId: string }>> {
  try {
    const session = await requireRole(["owner", "manager", "admin"]);
    const admin = createAdminClient();

    const bookingId = formData.get("booking_id") as string;
    const grade = formData.get("grade") as ConditionGrade;
    const notes = (formData.get("notes") as string) || "";
    const checklistRaw = (formData.get("checklist") as string) || "{}";

    if (!bookingId || !grade) {
      return { ok: false, error: "Missing required check-out fields." };
    }

    // 1. Fetch booking with resource info
    const { data: booking, error: fetchErr } = await admin
      .from("bookings")
      .select("id, status, start_at, end_at, resource_id, user_id, resources(id, name, owner_id)")
      .eq("id", bookingId)
      .maybeSingle() as { data: any; error: any };

    if (fetchErr || !booking) {
      return { ok: false, error: "Booking record not found." };
    }

    if (booking.status !== "approved") {
      return {
        ok: false,
        error: `Cannot check out booking with status '${booking.status}'. Must be 'approved'.`,
      };
    }

    // 2. Validate 30-minute grace window: [start_at - 30 mins, end_at]
    const now = new Date();
    const startAt = new Date(booking.start_at);
    const endAt = new Date(booking.end_at);
    const earliestCheckout = new Date(startAt.getTime() - 30 * 60 * 1000);

    if (now < earliestCheckout) {
      return {
        ok: false,
        error: `Check-out is not available yet. It opens 30 minutes before start time (at ${earliestCheckout.toLocaleTimeString()}).`,
      };
    }

    if (now > endAt) {
      return {
        ok: false,
        error: `Scheduled session interval has already ended (${endAt.toLocaleTimeString()}). Cannot perform check-out for an expired slot.`,
      };
    }

    // 3. Process photo uploads (1 to 4 photos)
    const photoFiles = formData.getAll("photos") as File[];
    const validPhotos = photoFiles.filter((f) => f && f.size > 0);

    if (validPhotos.length > 4) {
      return { ok: false, error: "Maximum 4 photos allowed per condition inspection." };
    }

    const uploadedPaths: string[] = [];
    for (let i = 0; i < validPhotos.length; i++) {
      const photo = validPhotos[i];
      if (photo.size > MAX_PHOTO_SIZE) {
        return { ok: false, error: `Photo "${photo.name}" exceeds the 5MB size limit.` };
      }
      if (!ALLOWED_MIME_TYPES.includes(photo.type)) {
        return { ok: false, error: `Photo "${photo.name}" has invalid format. Only JPEG, PNG, and WEBP are accepted.` };
      }

      const ext = photo.name.split(".").pop() || "jpg";
      const storagePath = `${bookingId}/checkout_${Date.now()}_${i + 1}.${ext}`;
      const buffer = Buffer.from(await photo.arrayBuffer());

      const { error: uploadError } = await admin.storage
        .from("condition-photos")
        .upload(storagePath, buffer, {
          contentType: photo.type,
          upsert: true,
        });

      if (uploadError) {
        console.error("Condition photo upload failed:", uploadError);
        return { ok: false, error: `Failed to upload condition photo: ${uploadError.message}` };
      }

      uploadedPaths.push(storagePath);
    }

    let checklist: Record<string, boolean> = {};
    try {
      checklist = JSON.parse(checklistRaw);
    } catch {
      checklist = {};
    }

    // 4. Insert condition report
    const { data: report, error: reportErr } = await admin
      .from("condition_reports")
      .insert({
        booking_id: bookingId,
        kind: "checkout",
        grade,
        notes: notes.trim() || null,
        checklist,
        photo_paths: uploadedPaths,
        recorded_by: session.user.id,
      })
      .select("id")
      .single();

    if (reportErr || !report) {
      return { ok: false, error: reportErr?.message || "Failed to record condition report." };
    }

    // 5. Transition booking status to 'checked_out'
    const nowIso = now.toISOString();
    const transitionRes = await transitionBooking(
      bookingId,
      "checked_out",
      {
        id: session.user.id,
        name: session.profile.full_name || session.user.email || "Staff",
        role: session.role,
      },
      `Check-out completed: Grade ${grade.toUpperCase()}. ${notes.trim()}`,
      {
        checked_out_at: nowIso,
      }
    );

    if (!transitionRes.ok) {
      return { ok: false, error: transitionRes.error };
    }

    // 6. Log audit entry
    await logAudit({
      actor: { id: session.user.id, name: session.profile.full_name || session.user.email },
      action: "condition_report_checkout",
      entityType: "condition_report",
      entityId: report.id,
      bookingId,
      resourceId: booking.resource_id,
      reason: `Grade assigned: ${grade.toUpperCase()}`,
      details: {
        grade,
        kind: "checkout",
        photo_count: uploadedPaths.length,
        checklist,
      },
    });

    // 7. Notify user
    const resourceName = booking.resources?.name || "Equipment";
    await notify(
      booking.user_id,
      "Equipment Checked Out",
      `Your session for "${resourceName}" has commenced. Condition grade assigned: ${grade.toUpperCase()}.`,
      `/bookings/${bookingId}`
    );

    revalidatePath("/handovers");
    revalidatePath("/bookings");
    revalidatePath(`/bookings/${bookingId}`);

    return { ok: true, data: { reportId: report.id } };
  } catch (err: any) {
    console.error("submitCheckoutReportAction error:", err);
    return { ok: false, error: err?.message || "Check-out process failed." };
  }
}

/**
 * Completes the physical return inspection for an active reservation.
 */
export async function submitReturnReportAction(
  formData: FormData
): Promise<ActionResult<{ reportId: string }>> {
  try {
    const session = await requireRole(["owner", "manager", "admin"]);
    const admin = createAdminClient();

    const bookingId = formData.get("booking_id") as string;
    const grade = formData.get("grade") as ConditionGrade;
    const notes = (formData.get("notes") as string) || "";
    const checklistRaw = (formData.get("checklist") as string) || "{}";

    if (!bookingId || !grade) {
      return { ok: false, error: "Missing required return fields." };
    }

    // 1. Fetch booking with resource info
    const { data: booking, error: fetchErr } = await admin
      .from("bookings")
      .select("id, status, start_at, end_at, resource_id, user_id, resources(id, name, owner_id)")
      .eq("id", bookingId)
      .maybeSingle() as { data: any; error: any };

    if (fetchErr || !booking) {
      return { ok: false, error: "Booking record not found." };
    }

    if (booking.status !== "checked_out") {
      return {
        ok: false,
        error: `Cannot process return for booking with status '${booking.status}'. Must be 'checked_out'.`,
      };
    }

    const now = new Date();
    const endAt = new Date(booking.end_at);
    const isLate = now > endAt;
    const minutesLate = isLate ? Math.round((now.getTime() - endAt.getTime()) / 60000) : 0;

    // 2. Process photo uploads (1 to 4 photos)
    const photoFiles = formData.getAll("photos") as File[];
    const validPhotos = photoFiles.filter((f) => f && f.size > 0);

    if (validPhotos.length > 4) {
      return { ok: false, error: "Maximum 4 photos allowed per condition inspection." };
    }

    const uploadedPaths: string[] = [];
    for (let i = 0; i < validPhotos.length; i++) {
      const photo = validPhotos[i];
      if (photo.size > MAX_PHOTO_SIZE) {
        return { ok: false, error: `Photo "${photo.name}" exceeds the 5MB size limit.` };
      }
      if (!ALLOWED_MIME_TYPES.includes(photo.type)) {
        return { ok: false, error: `Photo "${photo.name}" has invalid format. Only JPEG, PNG, and WEBP are accepted.` };
      }

      const ext = photo.name.split(".").pop() || "jpg";
      const storagePath = `${bookingId}/return_${Date.now()}_${i + 1}.${ext}`;
      const buffer = Buffer.from(await photo.arrayBuffer());

      const { error: uploadError } = await admin.storage
        .from("condition-photos")
        .upload(storagePath, buffer, {
          contentType: photo.type,
          upsert: true,
        });

      if (uploadError) {
        console.error("Condition return photo upload failed:", uploadError);
        return { ok: false, error: `Failed to upload condition photo: ${uploadError.message}` };
      }

      uploadedPaths.push(storagePath);
    }

    let checklist: Record<string, boolean> = {};
    try {
      checklist = JSON.parse(checklistRaw);
    } catch {
      checklist = {};
    }

    // 3. Insert condition report
    const { data: report, error: reportErr } = await admin
      .from("condition_reports")
      .insert({
        booking_id: bookingId,
        kind: "return",
        grade,
        notes: notes.trim() || null,
        checklist,
        photo_paths: uploadedPaths,
        recorded_by: session.user.id,
      })
      .select("id")
      .single();

    if (reportErr || !report) {
      return { ok: false, error: reportErr?.message || "Failed to record return condition report." };
    }

    // 4. Transition booking status to 'returned'
    const nowIso = now.toISOString();
    const transitionRes = await transitionBooking(
      bookingId,
      "returned",
      {
        id: session.user.id,
        name: session.profile.full_name || session.user.email || "Staff",
        role: session.role,
      },
      `Return completed: Grade ${grade.toUpperCase()}.${isLate ? ` Returned late by ${minutesLate}m.` : ""} ${notes.trim()}`,
      {
        returned_at: nowIso,
      }
    );

    if (!transitionRes.ok) {
      return { ok: false, error: transitionRes.error };
    }

    // 5. Log audit entry
    await logAudit({
      actor: { id: session.user.id, name: session.profile.full_name || session.user.email },
      action: "condition_report_return",
      entityType: "condition_report",
      entityId: report.id,
      bookingId,
      resourceId: booking.resource_id,
      reason: `Grade assigned: ${grade.toUpperCase()}`,
      details: {
        grade,
        kind: "return",
        late_return: isLate,
        minutes_late: minutesLate,
        photo_count: uploadedPaths.length,
        checklist,
      },
    });

    // 6. Notify student user
    const resourceName = booking.resources?.name || "Equipment";
    await notify(
      booking.user_id,
      "Equipment Returned & Inspected",
      `Your reservation for "${resourceName}" has been checked in and returned (Inspection Grade: ${grade.toUpperCase()}).${isLate ? ` Note: Returned ${minutesLate} minutes past scheduled session time.` : ""}`,
      `/bookings/${bookingId}`
    );

    revalidatePath("/handovers");
    revalidatePath("/bookings");
    revalidatePath(`/bookings/${bookingId}`);

    return { ok: true, data: { reportId: report.id } };
  } catch (err: any) {
    console.error("submitReturnReportAction error:", err);
    return { ok: false, error: err?.message || "Return process failed." };
  }
}

/**
 * Generates temporary signed URLs for an array of private condition photos.
 */
export async function getConditionPhotoSignedUrlsAction(
  photoPaths: string[]
): Promise<ActionResult<Record<string, string>>> {
  try {
    await requireUser();
    const admin = createAdminClient();
    const urlMap: Record<string, string> = {};

    for (const path of photoPaths) {
      if (!path) continue;
      const { data, error } = await admin.storage
        .from("condition-photos")
        .createSignedUrl(path, 3600);

      if (!error && data?.signedUrl) {
        urlMap[path] = data.signedUrl;
      }
    }

    return { ok: true, data: urlMap };
  } catch (err: any) {
    console.error("getConditionPhotoSignedUrlsAction error:", err);
    return { ok: false, error: err?.message || "Failed to load photos." };
  }
}

