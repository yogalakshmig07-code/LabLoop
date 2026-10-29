import { PriorityTier } from "@/types/db";

export interface FairnessCheckResult {
  ok: boolean;
  reason: string;
}

export interface WaitlistRequest {
  id: string;
  tier: PriorityTier;
  strikes: number;
  hoursUsedRecently: number;
  createdAt: string;
}

export interface RankedWaitlistEntry {
  id: string;
  score: number;
  rank: number;
}

/**
 * Computes a standardized numerical priority score for booking scheduling and waitlists.
 * Base score:
 *   - coursework: 100 points
 *   - research: 70 points
 *   - personal: 30 points
 * Penalties:
 *   - 25 points subtracted per active strike
 *   - 5 points subtracted per hour used in category during the past 7 days
 */
export function computePriorityScore(
  tier: PriorityTier,
  strikes: number = 0,
  hoursUsedRecently: number = 0
): { score: number; ok: boolean; reason: string } {
  let baseScore = 30;
  if (tier === "coursework") baseScore = 100;
  else if (tier === "research") baseScore = 70;

  const strikePenalty = Math.max(0, strikes) * 25;
  const usagePenalty = Math.max(0, hoursUsedRecently) * 5;
  const finalScore = Math.max(0, baseScore - strikePenalty - usagePenalty);

  const reasons: string[] = [
    `Base tier points: ${baseScore} (${tier})`,
  ];

  if (strikes > 0) {
    reasons.push(`-${strikePenalty} penalty for ${strikes} safety strike(s)`);
  }
  if (hoursUsedRecently > 0) {
    reasons.push(`-${usagePenalty} penalty for ${hoursUsedRecently}h recent equipment usage`);
  }

  const reasonText = `Priority score: ${finalScore}. [${reasons.join(", ")}] (Strikes lower waitlist priority rank but never block bookings automatically).`;

  return {
    score: finalScore,
    ok: true,
    reason: reasonText,
  };
}

/**
 * Sorts and ranks competing waitlist requests by priority score (descending)
 * with creation timestamp tie-breaking (FIFO for identical scores).
 */
export function rankWaitlist(requests: WaitlistRequest[]): RankedWaitlistEntry[] {
  const scored = requests.map((req) => {
    const { score } = computePriorityScore(req.tier, req.strikes, req.hoursUsedRecently);
    return {
      id: req.id,
      score,
      createdAtTime: new Date(req.createdAt).getTime(),
    };
  });

  // Higher score first; if equal, earlier submission (lower timestamp) wins
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.createdAtTime - b.createdAtTime;
  });

  return scored.map((item, index) => ({
    id: item.id,
    score: item.score,
    rank: index + 1,
  }));
}

/**
 * Checks whether the requested duration exceeds the allowed weekly allocation per category.
 */
export function checkWeeklyCap(
  hoursUsedInWeek: number,
  requestedDurationHours: number,
  maxWeeklyCap: number = 8
): FairnessCheckResult {
  const total = hoursUsedInWeek + requestedDurationHours;
  if (total > maxWeeklyCap) {
    return {
      ok: false,
      reason: `Weekly limit reached: Requested ${requestedDurationHours}h plus ${hoursUsedInWeek}h already booked would exceed the ${maxWeeklyCap}h/week limit for this category.`,
    };
  }

  const remaining = maxWeeklyCap - total;
  return {
    ok: true,
    reason: `Within weekly quota: ${remaining}h will remain after this ${requestedDurationHours}h reservation.`,
  };
}

/**
 * Checks whether adding a new booking exceeds the simultaneous active booking limit.
 */
export function checkActiveCap(
  activeBookingsCount: number,
  maxActiveCap: number = 3
): FairnessCheckResult {
  if (activeBookingsCount >= maxActiveCap) {
    return {
      ok: false,
      reason: `Maximum concurrent bookings reached: You currently have ${activeBookingsCount} active or pending reservations (maximum allowed is ${maxActiveCap}).`,
    };
  }

  const remainingSlots = maxActiveCap - activeBookingsCount - 1;
  return {
    ok: true,
    reason: `Concurrent booking allowed: ${remainingSlots} active booking slot(s) will remain.`,
  };
}

