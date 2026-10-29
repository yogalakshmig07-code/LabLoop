"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/session";
import { transitionBooking } from "@/lib/workflow";
import { recomputeWaitlistForResource } from "@/lib/bookings";
import { logAudit } from "@/lib/audit";
import { notify, notifyMany } from "@/lib/notify";
import { ActionResult } from "@/types/actions";
import { revalidatePath } from "next/cache";
import { checkSlotConflict } from "@/lib/bookings";

// ─── reviewBookingAction ────────────────────────────────────────────────────

export async function reviewBookingAction(
  bookingId: string,
  decision: "approved" | "rejected" | "waitlisted",
  reason: string
): Promise<ActionResult<void>> {
  try {
    const session = await requireRole(["owner", "manager", "admin"]);
    const actor = {
      id: session.user.id,
      name: session.profile.full_name || session.user.email || undefined,
      role: session.role,
    };

    const admin = createAdminClient();

    // Fetch the booking
    const { data: booking, error: fetchErr } = await admin
      .from("bookings")
      .select("id, resource_id, user_id, start_at, end_at, status")
      .eq("id", bookingId)
      .maybeSingle();

    if (fetchErr || !booking) {
      return { ok: false, error: "Booking not found." };
    }

    // Verify actor can manage this resource
    const { data: resource, error: resErr } = await admin
      .from("resources")
      .select("id, owner_id")
      .eq("id", booking.resource_id)
      .maybeSingle();

    if (resErr || !resource) {
      return { ok: false, error: "Resource not found." };
    }

    let canManage = session.role === "admin" || resource.owner_id === session.user.id;

    if (!canManage) {
      const { data: managerRow } = await admin
        .from("resource_managers")
        .select("resource_id")
        .eq("resource_id", booking.resource_id)
        .eq("user_id", session.user.id)
        .maybeSingle();
      canManage = Boolean(managerRow);
    }

    if (!canManage) {
      return { ok: false, error: "You do not have permission to manage this resource." };
    }

    // Validate reason for reject/waitlist
    if (decision === "rejected" && (!reason || reason.trim().length < 10)) {
      return { ok: false, error: "A reason of at least 10 characters is required for rejection." };
    }
    if (decision === "waitlisted" && (!reason || reason.trim().length < 10)) {
      return { ok: false, error: "A reason of at least 10 characters is required for waitlisting." };
    }

    if (decision === "approved") {
      // Transition
      const result = await transitionBooking(bookingId, "approved", actor, reason || "Approved");

      if (!result.ok) {
        if (result.error.toLowerCase().includes("overlap") || result.error.toLowerCase().includes("taken")) {
          return {
            ok: false,
            error:
              "Slot conflict: This time was just taken by another approval. Move to waitlist instead.",
          };
        }
        return { ok: false, error: result.error };
      }

      // Move all other overlapping pending_review/waitlisted bookings to waitlisted
      const { data: overlapping } = await admin
        .from("bookings")
        .select("id, user_id")
        .eq("resource_id", booking.resource_id)
        .in("status", ["pending_review", "waitlisted"])
        .neq("id", bookingId)
        .lt("start_at", booking.end_at)
        .gt("end_at", booking.start_at);

      if (overlapping && overlapping.length > 0) {
        for (const ob of overlapping) {
          await transitionBooking(
            ob.id,
            "waitlisted",
            actor,
            "Another booking was approved for this slot"
          );
          await notify(
            ob.user_id,
            "Request Moved to Waitlist",
            "Another booking was approved for the same slot. Your request has been moved to the waitlist.",
            `/bookings/${ob.id}`
          );
        }
      }

      // Recompute waitlist
      await recomputeWaitlistForResource(
        booking.resource_id,
        booking.start_at,
        booking.end_at
      );
    } else if (decision === "rejected") {
      const result = await transitionBooking(bookingId, "rejected", actor, reason);
      if (!result.ok) return { ok: false, error: result.error };
    } else {
      // waitlisted
      const result = await transitionBooking(bookingId, "waitlisted", actor, reason);
      if (!result.ok) return { ok: false, error: result.error };

      await recomputeWaitlistForResource(
        booking.resource_id,
        booking.start_at,
        booking.end_at
      );
    }

    // Audit log
    await logAudit({
      actor: { id: actor.id, name: actor.name },
      action: "booking_decision",
      entityType: "booking",
      entityId: bookingId,
      bookingId,
      resourceId: booking.resource_id,
      reason,
      details: { decision, reason },
    });

    revalidatePath("/review-queue");
    revalidatePath("/review");
    revalidatePath("/bookings");

    return { ok: true, data: undefined };
  } catch (err: any) {
    console.error("reviewBookingAction error:", err);
    return { ok: false, error: err?.message || "Unexpected error." };
  }
}

// ─── approveExtensionAction ─────────────────────────────────────────────────

export async function approveExtensionAction(
  bookingId: string,
  approve: boolean,
  reason?: string
): Promise<ActionResult<void>> {
  try {
    const session = await requireRole(["owner", "manager", "admin"]);
    const admin = createAdminClient();

    const { data: booking, error: fetchErr } = await admin
      .from("bookings")
      .select("id, resource_id, user_id, status, start_at, end_at, ext_requested_end_at, ext_status, resources(owner_id, name, buffer_minutes)")
      .eq("id", bookingId)
      .maybeSingle();

    if (fetchErr || !booking) {
      return { ok: false, error: "Booking not found." };
    }

    const resourceData = booking.resources as any;

    // Permission check
    let canManage =
      session.role === "admin" || resourceData?.owner_id === session.user.id;

    if (!canManage) {
      const { data: managerRow } = await admin
        .from("resource_managers")
        .select("resource_id")
        .eq("resource_id", booking.resource_id)
        .eq("user_id", session.user.id)
        .maybeSingle();
      canManage = Boolean(managerRow);
    }

    if (!canManage) {
      return { ok: false, error: "You do not have permission to manage this resource." };
    }

    if (!booking.ext_requested_end_at) {
      return { ok: false, error: "No extension request found for this booking." };
    }

    if (approve) {
      // Check slot conflict for the extension window [end_at → ext_requested_end_at]
      const bufferMinutes = resourceData?.buffer_minutes ?? 0;
      const conflict = await checkSlotConflict(
        booking.resource_id,
        new Date(booking.end_at),
        new Date(booking.ext_requested_end_at),
        bufferMinutes,
        bookingId
      );

      if (conflict.hasConflict) {
        return {
          ok: false,
          error: "Cannot approve extension: another booking already occupies that extended time window.",
        };
      }

      const { error: updateErr } = await admin
        .from("bookings")
        .update({
          end_at: booking.ext_requested_end_at,
          ext_status: "approved",
        })
        .eq("id", bookingId);

      if (updateErr) {
        return { ok: false, error: updateErr.message };
      }

      await logAudit({
        actor: { id: session.user.id, name: session.profile.full_name || session.user.email },
        action: "extension_approved",
        entityType: "booking",
        entityId: bookingId,
        bookingId,
        resourceId: booking.resource_id,
        reason: reason || "Extension approved",
        details: {
          original_end_at: booking.end_at,
          new_end_at: booking.ext_requested_end_at,
        },
      });

      await notify(
        booking.user_id,
        "Extension Approved",
        `Your extension request for "${resourceData?.name || "the resource"}" has been approved. New end time: ${new Date(booking.ext_requested_end_at).toLocaleString()}.`,
        `/bookings/${bookingId}`
      );
    } else {
      // Reject extension
      const { error: updateErr } = await admin
        .from("bookings")
        .update({ ext_status: "rejected" })
        .eq("id", bookingId);

      if (updateErr) {
        return { ok: false, error: updateErr.message };
      }

      await logAudit({
        actor: { id: session.user.id, name: session.profile.full_name || session.user.email },
        action: "extension_rejected",
        entityType: "booking",
        entityId: bookingId,
        bookingId,
        resourceId: booking.resource_id,
        reason: reason || "Extension rejected",
        details: { reason },
      });

      await notify(
        booking.user_id,
        "Extension Request Declined",
        `Your extension request for "${resourceData?.name || "the resource"}" was not approved.${reason ? ` Reason: ${reason}` : ""}`,
        `/bookings/${bookingId}`
      );
    }

    revalidatePath("/review-queue");
    return { ok: true, data: undefined };
  } catch (err: any) {
    console.error("approveExtensionAction error:", err);
    return { ok: false, error: err?.message || "Unexpected error." };
  }
}
