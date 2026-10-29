import "server-only";

import { createAdminClient } from "./supabase/admin";
import { ResourceCategory, PriorityTier, BookingStatus } from "@/types/db";
import { computePriorityScore, rankWaitlist, WaitlistRequest } from "./fairness";
import { checkEligibility } from "./eligibility";
import { startOfWeek, endOfWeek, addDays, format, parse, isAfter, isBefore } from "date-fns";

export interface FairnessSettingsData {
  id: number;
  max_active_bookings: number;
  max_hours_per_week_per_category: number;
  strike_threshold: number;
  reminder_minutes_before: number;
}

export interface AlternativeSlot {
  start_at: string;
  end_at: string;
  display_date: string;
  display_time: string;
}

export interface PreCheckResult {
  eligible: boolean;
  missingRequirements: string[];
  pendingRequirements: string[];
  activeCapOk: boolean;
  activeCapCurrent: number;
  activeCapMax: number;
  activeCapReason: string;
  weeklyCapOk: boolean;
  weeklyHoursUsed: number;
  weeklyHoursRequested: number;
  weeklyCapMax: number;
  weeklyCapReason: string;
  inFuture: boolean;
  withinOperatingHours: boolean;
  operatingHoursReason: string;
  withinMaxDuration: boolean;
  maxDurationHours: number;
  hasConflict: boolean;
  conflictReason?: string;
  alternativeSlots: AlternativeSlot[];
  canSubmit: boolean;
  mustWaitlist: boolean;
}

/**
 * Fetches campus fairness policy settings (singleton row).
 */
export async function getFairnessSettings(): Promise<FairnessSettingsData> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("fairness_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (data) {
      return data as FairnessSettingsData;
    }
  } catch (err) {
    console.error("Error fetching fairness_settings:", err);
  }

  return {
    id: 1,
    max_active_bookings: 3,
    max_hours_per_week_per_category: 8,
    strike_threshold: 3,
    reminder_minutes_before: 60,
  };
}

/**
 * Counts user's active bookings (pending_review, approved, checked_out).
 */
export async function getUserActiveBookingsCount(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["pending_review", "approved", "checked_out"]);

  if (error) {
    console.error("Error counting active bookings:", error.message);
    return 0;
  }
  return count || 0;
}

/**
 * Calculates total hours booked by the user in this category for the given week.
 */
export async function getUserWeeklyCategoryHours(
  userId: string,
  category: ResourceCategory,
  targetDate: Date
): Promise<number> {
  const admin = createAdminClient();
  const weekStart = startOfWeek(targetDate, { weekStartsOn: 1 }).toISOString();
  const weekEnd = endOfWeek(targetDate, { weekStartsOn: 1 }).toISOString();

  // Find all resources in this category
  const { data: resources } = await admin
    .from("resources")
    .select("id")
    .eq("category", category);

  if (!resources || resources.length === 0) return 0;
  const resourceIds = resources.map((r) => r.id);

  const { data: bookings } = await admin
    .from("bookings")
    .select("start_at, end_at, status")
    .eq("user_id", userId)
    .in("resource_id", resourceIds)
    .in("status", ["approved", "checked_out", "returned", "pending_review"])
    .gte("start_at", weekStart)
    .lte("start_at", weekEnd);

  if (!bookings || bookings.length === 0) return 0;

  let totalMs = 0;
  for (const b of bookings) {
    const s = new Date(b.start_at).getTime();
    const e = new Date(b.end_at).getTime();
    if (e > s) totalMs += e - s;
  }

  return Math.round((totalMs / (1000 * 60 * 60)) * 10) / 10;
}

/**
 * Checks if a requested timeframe conflicts with approved or checked_out bookings (including buffer).
 */
export async function checkSlotConflict(
  resourceId: string,
  startAt: Date,
  endAt: Date,
  bufferMinutes: number,
  excludeBookingId?: string
): Promise<{ hasConflict: boolean; conflictingBooking?: any }> {
  const admin = createAdminClient();

  const bufferMs = bufferMinutes * 60 * 1000;
  // A booking B conflicts with [startAt, endAt] if:
  // (B.start_at - buffer) < endAt AND (B.end_at + buffer) > startAt
  const searchStart = new Date(startAt.getTime() - bufferMs).toISOString();
  const searchEnd = new Date(endAt.getTime() + bufferMs).toISOString();

  let query = admin
    .from("bookings")
    .select("id, start_at, end_at, status")
    .eq("resource_id", resourceId)
    .in("status", ["approved", "checked_out"])
    .lt("start_at", searchEnd)
    .gt("end_at", searchStart);

  if (excludeBookingId) {
    query = query.neq("id", excludeBookingId);
  }

  const { data: conflicts } = await query;

  if (conflicts && conflicts.length > 0) {
    return { hasConflict: true, conflictingBooking: conflicts[0] };
  }

  return { hasConflict: false };
}

/**
 * Computes up to 5 alternative free slots within operating availability windows.
 */
export async function findAlternativeSlots(
  resourceId: string,
  requestedDateStr: string,
  durationMinutes: number,
  bufferMinutes: number,
  limit: number = 5
): Promise<AlternativeSlot[]> {
  const admin = createAdminClient();

  // Fetch availability windows for resource
  const { data: windows } = await admin
    .from("availability_windows")
    .select("day_of_week, start_time, end_time")
    .eq("resource_id", resourceId);

  if (!windows || windows.length === 0) return [];

  const alternatives: AlternativeSlot[] = [];
  const baseDate = parse(requestedDateStr, "yyyy-MM-dd", new Date());
  const now = new Date();

  // Check the requested date and the following 4 days
  for (let offset = 0; offset <= 4 && alternatives.length < limit; offset++) {
    const checkDate = addDays(baseDate, offset);
    const dayOfWeek = checkDate.getDay(); // 0=Sunday ... 6=Saturday
    const dayWindows = windows.filter((w) => w.day_of_week === dayOfWeek);

    if (dayWindows.length === 0) continue;

    const datePrefix = format(checkDate, "yyyy-MM-dd");

    // Fetch existing approved/checked_out bookings for this resource on this day
    const dayStartIso = `${datePrefix}T00:00:00.000Z`;
    const dayEndIso = `${datePrefix}T23:59:59.999Z`;

    const { data: dayBookings } = await admin
      .from("bookings")
      .select("start_at, end_at")
      .eq("resource_id", resourceId)
      .in("status", ["approved", "checked_out"])
      .gte("start_at", dayStartIso)
      .lte("end_at", dayEndIso);

    for (const win of dayWindows) {
      if (alternatives.length >= limit) break;

      const [startHour, startMin] = win.start_time.split(":").map(Number);
      const [endHour, endMin] = win.end_time.split(":").map(Number);

      const winStart = new Date(checkDate);
      winStart.setHours(startHour, startMin, 0, 0);

      const winEnd = new Date(checkDate);
      winEnd.setHours(endHour, endMin, 0, 0);

      // Iterate in 30-min steps
      let candidateStart = new Date(winStart);
      while (
        candidateStart.getTime() + durationMinutes * 60 * 1000 <= winEnd.getTime() &&
        alternatives.length < limit
      ) {
        const candidateEnd = new Date(candidateStart.getTime() + durationMinutes * 60 * 1000);

        // Slot must be at least 15 minutes in the future
        if (candidateStart.getTime() > now.getTime() + 15 * 60 * 1000) {
          // Check collision with day bookings including buffer
          const bufferMs = bufferMinutes * 60 * 1000;
          const collides = (dayBookings || []).some((b) => {
            const bStart = new Date(b.start_at).getTime() - bufferMs;
            const bEnd = new Date(b.end_at).getTime() + bufferMs;
            return candidateStart.getTime() < bEnd && candidateEnd.getTime() > bStart;
          });

          if (!collides) {
            alternatives.push({
              start_at: candidateStart.toISOString(),
              end_at: candidateEnd.toISOString(),
              display_date: format(candidateStart, "EEE, MMM d"),
              display_time: `${format(candidateStart, "h:mm a")} - ${format(candidateEnd, "h:mm a")}`,
            });
          }
        }

        // Increment candidate by 30 mins
        candidateStart = new Date(candidateStart.getTime() + 30 * 60 * 1000);
      }
    }
  }

  return alternatives.slice(0, limit);
}

/**
 * Recomputes waitlist scores and positions for competing requests on a slot.
 */
export async function recomputeWaitlistForResource(
  resourceId: string,
  startAt: string,
  endAt: string
): Promise<{ topBookingId?: string; count: number }> {
  const admin = createAdminClient();

  const { data: waitlisted } = await admin
    .from("bookings")
    .select(`
      id,
      user_id,
      priority_tier,
      created_at,
      profiles:user_id(strikes)
    `)
    .eq("resource_id", resourceId)
    .eq("status", "waitlisted")
    .lt("start_at", endAt)
    .gt("end_at", startAt);

  if (!waitlisted || waitlisted.length === 0) {
    return { count: 0 };
  }

  const requests: WaitlistRequest[] = waitlisted.map((b) => ({
    id: b.id,
    tier: b.priority_tier as PriorityTier,
    strikes: (b.profiles as any)?.strikes || 0,
    hoursUsedRecently: 0,
    createdAt: b.created_at,
  }));

  const ranked = rankWaitlist(requests);

  for (const r of ranked) {
    await admin
      .from("bookings")
      .update({ waitlist_rank: r.rank })
      .eq("id", r.id);
  }

  const top = ranked.find((r) => r.rank === 1);
  return { topBookingId: top?.id, count: ranked.length };
}

/**
 * Generates an explainable, plain-language breakdown for a booking decision.
 */
export function generateDecisionExplanation(booking: {
  status: BookingStatus;
  priority_tier: PriorityTier;
  decision_reason?: string | null;
  system_check?: any;
  waitlist_rank?: number | null;
}): {
  summary: string;
  bullets: string[];
} {
  const check = booking.system_check || {};
  const bullets: string[] = [];

  // 1. Eligibility
  if (check.eligibility?.eligible) {
    bullets.push("Eligibility: All safety induction & prerequisite training requirements met.");
  } else if (check.eligibility?.pending_count) {
    bullets.push(`Eligibility: ${check.eligibility.pending_count} certificate(s) pending lab staff verification.`);
  } else {
    bullets.push("Eligibility: Standard enrollment standing.");
  }

  // 2. Fair usage
  if (check.weekly_cap) {
    bullets.push(
      `Weekly Category Allocation: ${check.weekly_cap.used || 0} of ${check.weekly_cap.max || 8} hours booked.`
    );
  }

  // 3. Priority tier & score
  if (check.priority_score) {
    bullets.push(
      `Priority Tier: ${booking.priority_tier.toUpperCase()} (${check.priority_score.breakdown || `${check.priority_score.score} points`}).`
    );
  } else {
    bullets.push(`Priority Tier: ${booking.priority_tier.toUpperCase()}`);
  }

  // 4. Waitlist position
  if (booking.status === "waitlisted") {
    const rank = booking.waitlist_rank || check.waitlist?.rank || 1;
    const total = check.waitlist?.total_waitlisted || 1;
    bullets.push(`Waitlist Standing: Position #${rank} of ${total} competing reservation requests.`);
  }

  // 5. Conflict status
  if (check.conflict?.has_conflict) {
    bullets.push("Schedule Notice: Requested slot overlaps with an approved reservation session.");
  }

  // Summary header
  let summary = "";
  if (booking.status === "approved") {
    summary = booking.decision_reason
      ? `Approved by facility custodian: "${booking.decision_reason}"`
      : "Approved: All prerequisite safety checks and resource availability confirmed.";
  } else if (booking.status === "rejected") {
    summary = booking.decision_reason
      ? `Declined: "${booking.decision_reason}"`
      : "Reservation request was declined during administrative review.";
  } else if (booking.status === "waitlisted") {
    summary = booking.decision_reason
      ? `Waitlisted: "${booking.decision_reason}"`
      : "Slot is currently occupied; request is ranked on the waiting list by priority score.";
  } else if (booking.status === "checked_out") {
    summary = "Active Session: Resource checked out and currently in use.";
  } else if (booking.status === "returned") {
    summary = "Session Completed: Equipment returned and inspected by lab staff.";
  } else {
    summary = "Under Review: Awaiting custodian verification and slot confirmation.";
  }

  return { summary, bullets };
}

