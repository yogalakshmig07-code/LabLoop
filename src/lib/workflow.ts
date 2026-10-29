import "server-only";
import { createAdminClient } from "./supabase/admin";
import { BookingStatus, UpdateTables } from "@/types/db";
import { ActionResult } from "@/types/actions";
import { logAudit } from "./audit";
import { notify } from "./notify";

export interface BookingActor {
  id: string;
  name?: string;
  role?: string;
}

export interface TransitionExtraFields {
  decision_reason?: string;
  waitlist_rank?: number | null;
  checked_out_at?: string | null;
  returned_at?: string | null;
  system_check?: Record<string, unknown>;
  [key: string]: unknown;
}

const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending_review: ["approved", "rejected", "waitlisted", "cancelled"],
  waitlisted: ["approved", "rejected", "cancelled"],
  approved: ["checked_out", "cancelled"],
  checked_out: ["returned"],
  rejected: [],
  cancelled: [],
  returned: [],
};

/**
 * Centrally validates and executes state transitions for bookings.
 * Enforces business lifecycle constraints, writes to audit_log, sends in-app notifications,
 * and intercepts Postgres 23P01 exclusion constraint conflicts with human-readable error messages.
 */
export async function transitionBooking(
  bookingId: string,
  newStatus: BookingStatus,
  actor: BookingActor,
  reason: string,
  extraFields: TransitionExtraFields = {}
): Promise<ActionResult<{ bookingId: string; status: BookingStatus }>> {
  try {
    const admin = createAdminClient();

    // 1. Fetch current booking state
    const { data: booking, error: fetchError } = await admin
      .from("bookings")
      .select("id, resource_id, user_id, status, start_at, end_at, resources(name)")
      .eq("id", bookingId)
      .maybeSingle();

    if (fetchError || !booking) {
      return { ok: false, error: "Reservation record could not be found." };
    }

    const currentStatus = booking.status as BookingStatus;

    // 2. Validate state machine transition
    const allowedTargets = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowedTargets.includes(newStatus)) {
      return {
        ok: false,
        error: `Invalid transition: Bookings in state '${currentStatus}' cannot transition to '${newStatus}'.`,
      };
    }

    // 3. Prepare payload for update
    const updatePayload: UpdateTables<"bookings"> = {
      status: newStatus,
      decision_reason: reason || null,
      decided_by: actor.id,
      decided_at: new Date().toISOString(),
      ...(extraFields as any),
    };

    if (newStatus === "checked_out" && !updatePayload.checked_out_at) {
      updatePayload.checked_out_at = new Date().toISOString();
    }

    if (newStatus === "returned" && !updatePayload.returned_at) {
      updatePayload.returned_at = new Date().toISOString();
    }

    // 4. Perform update (may throw 23P01 if approved/checked_out overlaps)
    const { error: updateError } = await admin
      .from("bookings")
      .update(updatePayload)
      .eq("id", bookingId);

    if (updateError) {
      // 23P01 is Postgres exclusion_violation
      if (
        updateError.code === "23P01" ||
        updateError.message.toLowerCase().includes("overlap") ||
        updateError.message.toLowerCase().includes("exclude")
      ) {
        return {
          ok: false,
          error: "Selected slot already taken: Another approved or active reservation occupies this resource during the requested timeframe.",
        };
      }

      console.error("Database error updating booking status:", updateError);
      return { ok: false, error: updateError.message };
    }

    // 5. Write to audit_log
    const resourceName = (booking.resources as any)?.name || "Resource";
    await logAudit({
      actor: { id: actor.id, name: actor.name },
      action: `BOOKING_TRANSITION_${newStatus.toUpperCase()}`,
      entityType: "booking",
      entityId: bookingId,
      bookingId: bookingId,
      resourceId: booking.resource_id,
      reason: reason || `Status changed from ${currentStatus} to ${newStatus}`,
      details: {
        previous_status: currentStatus,
        new_status: newStatus,
        extra_fields: extraFields,
      },
    });

    // 6. Notify the booking applicant
    const notificationTitles: Record<BookingStatus, string> = {
      approved: "Booking Approved",
      rejected: "Booking Request Rejected",
      waitlisted: "Added to Waitlist",
      cancelled: "Booking Cancelled",
      checked_out: "Resource Checked Out",
      returned: "Resource Returned & Session Complete",
      pending_review: "Booking Under Review",
    };

    const title = notificationTitles[newStatus] || `Booking ${newStatus}`;
    const body = `Your reservation for "${resourceName}" has been updated to ${newStatus}.${
      reason ? ` Note: ${reason}` : ""
    }`;

    await notify(booking.user_id, title, body, `/bookings/${bookingId}`);

    return {
      ok: true,
      data: {
        bookingId,
        status: newStatus,
      },
    };
  } catch (err: any) {
    console.error("Exception during transitionBooking:", err);
    return { ok: false, error: err?.message || "An unexpected error occurred." };
  }
}
