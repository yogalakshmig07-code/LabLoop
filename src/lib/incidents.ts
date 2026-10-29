import "server-only";

import { createAdminClient } from "./supabase/admin";
import { getFairnessSettings } from "./bookings";

export interface SuspiciousUsagePatterns {
  lateReturnsCount: number;
  shortNoticeCancellationsCount: number;
  repeatedResourceBookingsCount: number;
  strikesCount: number;
  strikeThreshold: number;
  chips: string[];
}

/**
 * Analyzes a user's booking history and strike record to detect
 * operational anomalies and suspicious usage patterns for human reviewers.
 *
 * Checks:
 * 1. 2+ late returns (past end_at)
 * 2. Frequent short-notice cancellations (<24h before start)
 * 3. High demand / repeated bookings of the same scarce resource (>=3 in past 30 days)
 * 4. High strike count (>= strike_threshold)
 */
export async function detectSuspiciousUsagePatterns(
  userId: string,
  resourceId?: string
): Promise<SuspiciousUsagePatterns> {
  const admin = createAdminClient();
  const fairnessSettings = await getFairnessSettings();
  const strikeThreshold = fairnessSettings?.strike_threshold || 3;

  const chips: string[] = [];

  // 1. Fetch user profile strikes
  const { data: userProfile } = await admin
    .from("profiles")
    .select("strikes")
    .eq("id", userId)
    .maybeSingle();

  const strikesCount = userProfile?.strikes || 0;
  if (strikesCount >= strikeThreshold) {
    chips.push(`High strike count (${strikesCount})`);
  } else if (strikesCount > 0) {
    chips.push(`${strikesCount} active strike${strikesCount !== 1 ? "s" : ""}`);
  }

  // 2. Query user's past bookings
  const { data: pastBookings } = await admin
    .from("bookings")
    .select("id, status, start_at, end_at, returned_at, resource_id, created_at")
    .eq("user_id", userId);

  const bookingsList = pastBookings || [];

  // Check late returns: returned_at > end_at or audit_log overdue_flagged
  let lateReturnsCount = 0;
  for (const b of bookingsList) {
    if (b.status === "returned" && b.returned_at && b.end_at) {
      if (new Date(b.returned_at).getTime() > new Date(b.end_at).getTime()) {
        lateReturnsCount++;
      }
    }
  }

  // Also query overdue_flagged audit logs for user's bookings
  const bookingIds = bookingsList.map((b) => b.id);
  if (bookingIds.length > 0) {
    const { data: overdueLogs } = await admin
      .from("audit_log")
      .select("booking_id")
      .eq("action", "overdue_flagged")
      .in("booking_id", bookingIds);

    const flaggedIds = new Set(overdueLogs?.map((l) => l.booking_id) || []);
    // Combine count
    lateReturnsCount = Math.max(lateReturnsCount, flaggedIds.size);
  }

  if (lateReturnsCount >= 2) {
    chips.push(`${lateReturnsCount}+ late returns`);
  } else if (lateReturnsCount === 1) {
    chips.push("1 late return record");
  }

  // Check short-notice cancellations (<24h before start_at)
  let shortNoticeCancellationsCount = 0;
  const cancelledBookings = bookingsList.filter((b) => b.status === "cancelled");
  if (cancelledBookings.length > 0) {
    const cancelledIds = cancelledBookings.map((b) => b.id);
    const { data: cancelLogs } = await admin
      .from("audit_log")
      .select("booking_id, created_at")
      .eq("action", "booking_cancelled")
      .in("booking_id", cancelledIds);

    for (const cLog of cancelLogs || []) {
      const match = cancelledBookings.find((b) => b.id === cLog.booking_id);
      if (match) {
        const cancelTime = new Date(cLog.created_at).getTime();
        const startTime = new Date(match.start_at).getTime();
        const diffHours = (startTime - cancelTime) / (1000 * 60 * 60);
        if (diffHours < 24) {
          shortNoticeCancellationsCount++;
        }
      }
    }
  }

  if (shortNoticeCancellationsCount >= 2) {
    chips.push("Frequent short-notice cancellations (<24h)");
  }

  // Check repeated bookings of the same resource in past 30 days
  let repeatedResourceBookingsCount = 0;
  if (resourceId) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sameResourceBookings = bookingsList.filter(
      (b) => b.resource_id === resourceId && b.created_at >= thirtyDaysAgo
    );
    repeatedResourceBookingsCount = sameResourceBookings.length;

    if (repeatedResourceBookingsCount >= 3) {
      chips.push(`Frequent bookings of this resource (${repeatedResourceBookingsCount} in 30d)`);
    }
  }

  return {
    lateReturnsCount,
    shortNoticeCancellationsCount,
    repeatedResourceBookingsCount,
    strikesCount,
    strikeThreshold,
    chips,
  };
}

