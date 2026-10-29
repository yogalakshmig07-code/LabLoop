"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { transitionBooking } from "@/lib/workflow";
import { canManageResource } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { notify, notifyMany } from "@/lib/notify";
import { BookingStatus, PriorityTier, ResourceCategory } from "@/types/db";
import { ActionResult } from "@/types/actions";
import { BookingDecisionSchema } from "@/lib/validations";
import {
  getFairnessSettings,
  getUserActiveBookingsCount,
  getUserWeeklyCategoryHours,
  checkSlotConflict,
  findAlternativeSlots,
  recomputeWaitlistForResource,
  PreCheckResult,
  AlternativeSlot,
} from "@/lib/bookings";
import {
  checkEligibility,
} from "@/lib/eligibility";
import {
  computePriorityScore,
  checkWeeklyCap,
  checkActiveCap,
} from "@/lib/fairness";

// ─── preCheckBookingAction ──────────────────────────────────────────────────

export interface PreCheckInput {
  resource_id: string;
  date: string;       // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
}

export async function preCheckBookingAction(
  input: PreCheckInput
): Promise<ActionResult<PreCheckResult>> {
  try {
    const { user } = await requireUser();
    const { resource_id, date, start_time, end_time } = input;

    if (!resource_id || !date || !start_time || !end_time) {
      return { ok: false, error: "Missing required fields for pre-check." };
    }

    // Parse start/end times
    const startAt = new Date(`${date}T${start_time}:00`);
    const endAt = new Date(`${date}T${end_time}:00`);
    const now = new Date();

    const inFuture = startAt > now;
    const endAfterStart = endAt > startAt;

    if (!endAfterStart) {
      return {
        ok: true,
        data: buildPartialResult({
          inFuture,
          withinOperatingHours: false,
          operatingHoursReason: "End time must be after start time.",
          withinMaxDuration: false,
          maxDurationHours: 0,
          hasConflict: false,
          alternativeSlots: [],
          activeCapOk: true,
          activeCapCurrent: 0,
          activeCapMax: 3,
          activeCapReason: "",
          weeklyCapOk: true,
          weeklyHoursUsed: 0,
          weeklyHoursRequested: 0,
          weeklyCapMax: 8,
          weeklyCapReason: "",
          eligible: true,
          missingRequirements: [],
          pendingRequirements: [],
          canSubmit: false,
          mustWaitlist: false,
        }),
      };
    }

    const durationMs = endAt.getTime() - startAt.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);

    // Fetch resource details
    const admin = createAdminClient();
    const { data: resource } = await admin
      .from("resources")
      .select("id, max_duration_hours, buffer_minutes, category, owner_id, availability_windows(*)")
      .eq("id", resource_id)
      .maybeSingle() as { data: any };

    if (!resource) {
      return { ok: false, error: "Resource not found." };
    }

    const maxDurationHours: number = resource.max_duration_hours ?? 4;
    const bufferMinutes: number = resource.buffer_minutes ?? 0;
    const category: ResourceCategory = resource.category as ResourceCategory;
    const windows: Array<{ day_of_week: number; start_time: string; end_time: string }> =
      resource.availability_windows ?? [];

    // Check max duration
    const withinMaxDuration = durationHours <= maxDurationHours;

    // Check operating hours (day_of_week: 0=Sun..6=Sat)
    const dayOfWeek = startAt.getDay();
    const dayWindows = windows.filter((w) => w.day_of_week === dayOfWeek);

    let withinOperatingHours = false;
    let operatingHoursReason = "No availability windows configured for this day.";

    if (dayWindows.length > 0) {
      for (const win of dayWindows) {
        const [wsh, wsm] = win.start_time.split(":").map(Number);
        const [weh, wem] = win.end_time.split(":").map(Number);
        const winStart = new Date(startAt);
        winStart.setHours(wsh, wsm, 0, 0);
        const winEnd = new Date(startAt);
        winEnd.setHours(weh, wem, 0, 0);

        if (startAt >= winStart && endAt <= winEnd) {
          withinOperatingHours = true;
          operatingHoursReason = `Within availability window ${win.start_time.slice(0, 5)}-${win.end_time.slice(0, 5)}.`;
          break;
        }
      }
      if (!withinOperatingHours) {
        operatingHoursReason = `Slot falls outside operating hours for this day.`;
      }
    }

    // Fairness settings
    const settings = await getFairnessSettings();
    const maxActiveBookings = settings.max_active_bookings;
    const maxWeeklyHours = settings.max_hours_per_week_per_category;

    // Active cap
    const activeCount = await getUserActiveBookingsCount(user.id);
    const activeCapCheck = checkActiveCap(activeCount, maxActiveBookings);

    // Weekly cap
    const weeklyHoursUsed = await getUserWeeklyCategoryHours(user.id, category, startAt);
    const weeklyCapCheck = checkWeeklyCap(weeklyHoursUsed, durationHours, maxWeeklyHours);

    // Conflict check
    const conflictResult = await checkSlotConflict(
      resource_id,
      startAt,
      endAt,
      bufferMinutes
    );

    let alternativeSlots: AlternativeSlot[] = [];
    if (conflictResult.hasConflict) {
      const durationMinutes = Math.round(durationHours * 60);
      alternativeSlots = await findAlternativeSlots(
        resource_id,
        date,
        durationMinutes,
        bufferMinutes
      );
    }

    // Eligibility check
    const eligibilityResult = await checkEligibility(user.id, resource_id);
    const missingRequirements = eligibilityResult.items
      .filter((i) => i.status === "missing" || i.status === "expired")
      .map((i) => i.requirement);
    const pendingRequirements = eligibilityResult.items
      .filter((i) => i.status === "pending")
      .map((i) => i.requirement);

    const canSubmit =
      inFuture &&
      endAfterStart &&
      withinMaxDuration &&
      withinOperatingHours &&
      activeCapCheck.ok &&
      weeklyCapCheck.ok &&
      missingRequirements.length === 0;

    const mustWaitlist = conflictResult.hasConflict && canSubmit;

    const result: PreCheckResult = {
      eligible: eligibilityResult.eligible,
      missingRequirements,
      pendingRequirements,
      activeCapOk: activeCapCheck.ok,
      activeCapCurrent: activeCount,
      activeCapMax: maxActiveBookings,
      activeCapReason: activeCapCheck.reason,
      weeklyCapOk: weeklyCapCheck.ok,
      weeklyHoursUsed,
      weeklyHoursRequested: durationHours,
      weeklyCapMax: maxWeeklyHours,
      weeklyCapReason: weeklyCapCheck.reason,
      inFuture,
      withinOperatingHours,
      operatingHoursReason,
      withinMaxDuration,
      maxDurationHours,
      hasConflict: conflictResult.hasConflict,
      conflictReason: conflictResult.hasConflict
        ? `This slot overlaps with an existing approved booking (including ${bufferMinutes} min buffer).`
        : undefined,
      alternativeSlots,
      canSubmit,
      mustWaitlist,
    };

    return { ok: true, data: result };
  } catch (err: any) {
    console.error("preCheckBookingAction error:", err);
    return { ok: false, error: err?.message || "Pre-check failed." };
  }
}

function buildPartialResult(partial: PreCheckResult): PreCheckResult {
  return partial;
}

// ─── createBookingRequest ───────────────────────────────────────────────────

export async function createBookingRequest(
  formData: FormData
): Promise<ActionResult<{ bookingId: string; status: string; message: string }>> {
  try {
    const { user, profile } = await requireUser();
    const admin = createAdminClient();

    // Parse form data
    const resource_id = formData.get("resource_id") as string;
    const date = formData.get("date") as string;
    const start_time = formData.get("start_time") as string;
    const end_time = formData.get("end_time") as string;
    const purpose = formData.get("purpose") as string;
    const priority_tier = formData.get("priority_tier") as PriorityTier;
    const rules_acknowledged = formData.get("rules_acknowledged") === "true";
    const join_waitlist_if_conflict = formData.get("join_waitlist_if_conflict") === "true";

    if (!resource_id || !date || !start_time || !end_time || !purpose || !priority_tier) {
      return { ok: false, error: "Missing required booking fields." };
    }

    if (!rules_acknowledged) {
      return { ok: false, error: "You must acknowledge the usage rules to submit a booking request." };
    }

    const startAt = new Date(`${date}T${start_time}:00`);
    const endAt = new Date(`${date}T${end_time}:00`);
    const now = new Date();

    if (startAt <= now) {
      return { ok: false, error: "Requested start time must be in the future." };
    }
    if (endAt <= startAt) {
      return { ok: false, error: "End time must be after start time." };
    }

    const durationMs = endAt.getTime() - startAt.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);

    // Fetch resource
    const { data: resource } = await admin
      .from("resources")
      .select("id, name, max_duration_hours, buffer_minutes, category, owner_id, is_active")
      .eq("id", resource_id)
      .maybeSingle() as { data: any };

    if (!resource) {
      return { ok: false, error: "Resource not found." };
    }
    if (!resource.is_active) {
      return { ok: false, error: "This resource is currently inactive and cannot be booked." };
    }
    if (durationHours > resource.max_duration_hours) {
      return {
        ok: false,
        error: `Requested duration (${durationHours.toFixed(1)}h) exceeds the maximum allowed session duration (${resource.max_duration_hours}h).`,
      };
    }

    const category: ResourceCategory = resource.category as ResourceCategory;

    // ── a. Eligibility ──────────────────────────────────────────────────────
    const eligibilityResult = await checkEligibility(user.id, resource_id);
    const blockedItems = eligibilityResult.items.filter(
      (i) => i.status === "missing" || i.status === "expired"
    );
    const pendingItems = eligibilityResult.items.filter((i) => i.status === "pending");

    if (blockedItems.length > 0) {
      return {
        ok: false,
        error: `Missing requirements: ${blockedItems.map((i) => i.requirement).join(", ")}`,
      };
    }

    // ── b. Fair usage caps ──────────────────────────────────────────────────
    const settings = await getFairnessSettings();
    const activeCount = await getUserActiveBookingsCount(user.id);
    const activeCapCheck = checkActiveCap(activeCount, settings.max_active_bookings);

    if (!activeCapCheck.ok) {
      return { ok: false, error: activeCapCheck.reason };
    }

    const weeklyHoursUsed = await getUserWeeklyCategoryHours(user.id, category, startAt);
    const weeklyCapCheck = checkWeeklyCap(
      weeklyHoursUsed,
      durationHours,
      settings.max_hours_per_week_per_category
    );

    if (!weeklyCapCheck.ok) {
      return { ok: false, error: weeklyCapCheck.reason };
    }

    // ── c. Conflict check ───────────────────────────────────────────────────
    const conflictResult = await checkSlotConflict(
      resource_id,
      startAt,
      endAt,
      resource.buffer_minutes ?? 0
    );

    // Build system_check object (will be expanded after booking is created)
    const system_check: Record<string, unknown> = {
      eligibility: {
        eligible: eligibilityResult.eligible,
        pending_count: pendingItems.length,
        items: eligibilityResult.items,
      },
      active_cap: {
        ok: activeCapCheck.ok,
        count: activeCount,
        max: settings.max_active_bookings,
      },
      weekly_cap: {
        ok: weeklyCapCheck.ok,
        used: weeklyHoursUsed,
        requested: durationHours,
        max: settings.max_hours_per_week_per_category,
      },
      conflict: {
        has_conflict: conflictResult.hasConflict,
      },
    };

    let bookingStatus: BookingStatus;
    let waitlistRank: number | null = null;

    if (conflictResult.hasConflict && !join_waitlist_if_conflict) {
      // Return conflict info for the client to show conflict UI
      return {
        ok: false,
        error: `This time slot conflicts with an existing booking (including ${resource.buffer_minutes ?? 0} min buffer). You can join the waitlist for this slot.`,
      };
    }

    // Compute priority score
    const strikes: number = (profile as any)?.strikes ?? 0;
    const priorityScoreResult = computePriorityScore(priority_tier, strikes, weeklyHoursUsed);

    system_check.priority_score = {
      score: priorityScoreResult.score,
      breakdown: priorityScoreResult.reason,
    };

    if (conflictResult.hasConflict && join_waitlist_if_conflict) {
      bookingStatus = "waitlisted";
    } else {
      bookingStatus = "pending_review";
    }

    // ── Insert booking ──────────────────────────────────────────────────────
    const { data: booking, error: insertError } = await admin
      .from("bookings")
      .insert({
        resource_id,
        user_id: user.id,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        purpose,
        priority_tier,
        status: bookingStatus,
        rules_acknowledged: true,
        system_check: system_check as any,
      })
      .select("id")
      .single();

    if (insertError || !booking) {
      return { ok: false, error: insertError?.message || "Failed to create booking." };
    }

    const bookingId = booking.id;

    // ── Waitlist recompute & update system_check ────────────────────────────
    if (bookingStatus === "waitlisted") {
      const waitlistResult = await recomputeWaitlistForResource(
        resource_id,
        startAt.toISOString(),
        endAt.toISOString()
      );

      // Find this booking's rank
      const { data: thisBooking } = await admin
        .from("bookings")
        .select("waitlist_rank")
        .eq("id", bookingId)
        .maybeSingle();

      waitlistRank = thisBooking?.waitlist_rank ?? null;

      system_check.waitlist = {
        rank: waitlistRank,
        total_waitlisted: waitlistResult.count,
      };

      // Update system_check with waitlist info
      await admin
        .from("bookings")
        .update({ system_check: system_check as any })
        .eq("id", bookingId);
    }

    // ── Audit log ───────────────────────────────────────────────────────────
    await logAudit({
      actor: { id: user.id, name: profile?.full_name || user.email },
      action: "BOOKING_REQUESTED",
      entityType: "booking",
      entityId: bookingId,
      bookingId,
      resourceId: resource_id,
      reason: purpose,
      details: {
        priority_tier,
        status: bookingStatus,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        waitlist_rank: waitlistRank,
      },
    });

    // ── Notify resource owner & managers ────────────────────────────────────
    const { data: managers } = await admin
      .from("resource_managers")
      .select("user_id")
      .eq("resource_id", resource_id);

    const managerIds = (managers ?? []).map((m: any) => m.user_id);
    const allNotifyIds = Array.from(
      new Set([resource.owner_id, ...managerIds].filter(Boolean))
    );

    const notifyBody =
      bookingStatus === "waitlisted"
        ? `New waitlist request for "${resource.name}" from ${profile?.full_name || user.email}.`
        : `New booking request for "${resource.name}" requires your review.`;

    if (allNotifyIds.length > 0) {
      await notifyMany(allNotifyIds, "New Booking Request", notifyBody, `/review-queue`);
    }

    // ── Notify user ─────────────────────────────────────────────────────────
    const userNotifyTitle =
      bookingStatus === "waitlisted" ? "Added to Waitlist" : "Booking Request Submitted";

    const userNotifyBody =
      bookingStatus === "waitlisted"
        ? `You've been added to the waitlist for "${resource.name}" (position #${waitlistRank ?? "?"}).`
        : `Your reservation request for "${resource.name}" has been submitted and is under review.`;

    await notify(user.id, userNotifyTitle, userNotifyBody, `/bookings/${bookingId}`);

    revalidatePath("/bookings");
    revalidatePath(`/resources/${resource_id}`);

    const message =
      bookingStatus === "waitlisted"
        ? `You've been placed on the waitlist at position #${waitlistRank ?? "?"}.`
        : "Your booking request has been submitted and is pending review.";

    return {
      ok: true,
      data: {
        bookingId,
        status: bookingStatus,
        message,
      },
    };
  } catch (err: any) {
    console.error("createBookingRequest error:", err);
    return { ok: false, error: err?.message || "An unexpected error occurred." };
  }
}

// ─── decideBooking (preserved from original) ────────────────────────────────

export async function decideBooking(rawInput: unknown) {
  const session = await requireUser();

  const parseResult = BookingDecisionSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.errors.map((e) => e.message).join(", ") };
  }

  const input = parseResult.data;
  const adminSupabase = createAdminClient();

  const { data: booking, error: bErr } = await adminSupabase
    .from("bookings")
    .select("id, resource_id, user_id, start_at, end_at, status, resources(owner_id)")
    .eq("id", input.booking_id)
    .single();

  if (bErr || !booking) {
    return { success: false, error: "Booking not found." };
  }

  const ownerId = (booking.resources as any)?.owner_id || "";
  const hasPermission = await canManageResource(session, {
    id: booking.resource_id,
    owner_id: ownerId,
  });

  if (!hasPermission) {
    return { success: false, error: "Insufficient permissions to decide on this reservation." };
  }

  const transitionResult = await transitionBooking(
    input.booking_id,
    input.decision as BookingStatus,
    {
      id: session.user.id,
      name: session.profile.full_name || session.user.email || undefined,
      role: session.role,
    },
    input.decision_reason
  );

  if (!transitionResult.ok) {
    return { success: false, error: transitionResult.error };
  }

  revalidatePath("/bookings");
  revalidatePath("/review-queue");
  revalidatePath(`/bookings/${booking.id}`);
  return { success: true };
}
