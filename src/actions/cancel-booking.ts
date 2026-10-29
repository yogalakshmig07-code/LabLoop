"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/session";
import { transitionBooking } from "@/lib/workflow";
import { recomputeWaitlistForResource } from "@/lib/bookings";
import { logAudit } from "@/lib/audit";
import { notify, notifyMany } from "@/lib/notify";
import { ActionResult } from "@/types/actions";
import { revalidatePath } from "next/cache";

// ─── cancelBookingAction ─────────────────────────────────────────────────────

export async function cancelBookingAction(
  bookingId: string,
  reason: string
): Promise<ActionResult<void>> {
  try {
    const session = await requireUser();
    const admin = createAdminClient();

    const { data: booking, error: fetchErr } = await admin
      .from("bookings")
      .select("id, user_id, resource_id, status, start_at, end_at, resources(owner_id, name)")
      .eq("id", bookingId)
      .maybeSingle();

    if (fetchErr || !booking) {
      return { ok: false, error: "Booking not found." };
    }

    const resourceData = booking.resources as any;

    // Check ownership or management permissions
    const isOwner = booking.user_id === session.user.id;
    let canManage = session.role === "admin" || resourceData?.owner_id === session.user.id;

    if (!canManage) {
      const { data: managerRow } = await admin
        .from("resource_managers")
        .select("resource_id")
        .eq("resource_id", booking.resource_id)
        .eq("user_id", session.user.id)
        .maybeSingle();
      canManage = Boolean(managerRow);
    }

    if (!isOwner && !canManage) {
      return { ok: false, error: "You do not have permission to cancel this booking." };
    }

    const allowedStatuses = ["pending_review", "waitlisted", "approved"];
    if (!allowedStatuses.includes(booking.status)) {
      return {
        ok: false,
        error: `Cannot cancel a booking with status '${booking.status}'.`,
      };
    }

    const wasApproved = booking.status === "approved";
    const actor = {
      id: session.user.id,
      name: session.profile.full_name || session.user.email || undefined,
      role: session.role,
    };

    const result = await transitionBooking(
      bookingId,
      "cancelled",
      actor,
      reason || "Cancelled by user"
    );

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    if (wasApproved) {
      const now = new Date();
      const startAt = new Date(booking.start_at);
      const hoursUntilStart = (startAt.getTime() - now.getTime()) / (1000 * 60 * 60);
      const isLate = hoursUntilStart < 2;

      // Log with late_cancellation flag if applicable
      await logAudit({
        actor: { id: actor.id, name: actor.name },
        action: "BOOKING_CANCELLED",
        entityType: "booking",
        entityId: bookingId,
        bookingId,
        resourceId: booking.resource_id,
        reason: reason || "Cancelled by user",
        details: {
          was_approved: true,
          late_cancellation: isLate,
        },
      });

      // Notify resource owner
      if (resourceData?.owner_id) {
        await notify(
          resourceData.owner_id,
          "A booking was cancelled",
          `An approved booking for "${resourceData?.name || "your resource"}" was cancelled.${isLate ? " (Late cancellation — less than 2 hours before start)" : ""}`,
          `/review-queue`
        );
      }

      // Recompute waitlist — if there's a top candidate, notify managers
      const { topBookingId, count } = await recomputeWaitlistForResource(
        booking.resource_id,
        booking.start_at,
        booking.end_at
      );

      if (topBookingId && count > 0) {
        // Get all manager IDs for the resource
        const { data: managers } = await admin
          .from("resource_managers")
          .select("user_id")
          .eq("resource_id", booking.resource_id);

        const managerIds = managers?.map((m) => m.user_id) || [];
        const notifyIds = resourceData?.owner_id
          ? Array.from(new Set([resourceData.owner_id, ...managerIds]))
          : managerIds;

        if (notifyIds.length > 0) {
          await notifyMany(
            notifyIds,
            "Top Waitlisted Request Ready for Review",
            "A slot just opened — the top-ranked waitlisted request is ready for your approval.",
            `/review-queue`
          );
        }
      }
    } else {
      // Non-approved cancellation — still log
      await logAudit({
        actor: { id: actor.id, name: actor.name },
        action: "BOOKING_CANCELLED",
        entityType: "booking",
        entityId: bookingId,
        bookingId,
        resourceId: booking.resource_id,
        reason: reason || "Cancelled by user",
        details: { was_approved: false },
      });
    }

    revalidatePath("/bookings");
    return { ok: true, data: undefined };
  } catch (err: any) {
    console.error("cancelBookingAction error:", err);
    return { ok: false, error: err?.message || "Unexpected error." };
  }
}

// ─── requestExtensionAction ──────────────────────────────────────────────────

export async function requestExtensionAction(
  bookingId: string,
  newEndAt: string
): Promise<ActionResult<void>> {
  try {
    const session = await requireUser();
    const admin = createAdminClient();

    const { data: booking, error: fetchErr } = await admin
      .from("bookings")
      .select("id, user_id, status, end_at, resource_id, resources(owner_id, name)")
      .eq("id", bookingId)
      .maybeSingle();

    if (fetchErr || !booking) {
      return { ok: false, error: "Booking not found." };
    }

    if (booking.user_id !== session.user.id) {
      return { ok: false, error: "You can only request an extension for your own booking." };
    }

    if (booking.status !== "checked_out") {
      return { ok: false, error: "Extensions can only be requested for checked-out bookings." };
    }

    const newEnd = new Date(newEndAt);
    const currentEnd = new Date(booking.end_at);
    if (newEnd <= currentEnd) {
      return { ok: false, error: "New end time must be after the current end time." };
    }

    const { error: updateErr } = await admin
      .from("bookings")
      .update({
        ext_requested_end_at: newEndAt,
        ext_status: "pending",
      })
      .eq("id", bookingId);

    if (updateErr) {
      return { ok: false, error: updateErr.message };
    }

    await logAudit({
      actor: { id: session.user.id, name: session.profile.full_name || session.user.email },
      action: "extension_requested",
      entityType: "booking",
      entityId: bookingId,
      bookingId,
      resourceId: booking.resource_id,
      reason: "User requested time extension",
      details: {
        current_end_at: booking.end_at,
        requested_end_at: newEndAt,
      },
    });

    const resourceData = booking.resources as any;

    // Notify owner + managers
    const { data: managers } = await admin
      .from("resource_managers")
      .select("user_id")
      .eq("resource_id", booking.resource_id);

    const managerIds = managers?.map((m) => m.user_id) || [];
    const notifyIds = resourceData?.owner_id
      ? Array.from(new Set([resourceData.owner_id, ...managerIds]))
      : managerIds;

    if (notifyIds.length > 0) {
      await notifyMany(
        notifyIds,
        "Extension Request Received",
        `A user has requested to extend their booking for "${resourceData?.name || "a resource"}" to ${new Date(newEndAt).toLocaleString()}.`,
        `/review-queue`
      );
    }

    revalidatePath("/bookings");
    return { ok: true, data: undefined };
  } catch (err: any) {
    console.error("requestExtensionAction error:", err);
    return { ok: false, error: err?.message || "Unexpected error." };
  }
}
