import "server-only";

import { createAdminClient } from "./supabase/admin";
import { getFairnessSettings } from "./bookings";
import { logAudit } from "./audit";
import { notify } from "./notify";
import { format } from "date-fns";

let lastRunTimestamp = 0;
const THROTTLE_MS = 60 * 1000; // 60 seconds minimum between automatic checks

export interface OverdueCheckResult {
  overdueFlaggedCount: number;
  remindersSentCount: number;
  checkedAt: string;
}

/**
 * Scans active and upcoming reservations to:
 * 1. Flag checked-out bookings that are past their scheduled end_at timestamp (one-time notification & audit log).
 * 2. Send one-time pre-session reminders to approved bookings starting within the configured reminder window.
 *
 * Utilizes idempotency guards against duplicate audit logs and notifications.
 */
export async function checkOverdueAndReminders(
  force: boolean = false
): Promise<OverdueCheckResult> {
  const now = new Date();
  const nowMs = now.getTime();

  // Throttle automatic checks from layout requests unless explicitly forced
  if (!force && nowMs - lastRunTimestamp < THROTTLE_MS) {
    return {
      overdueFlaggedCount: 0,
      remindersSentCount: 0,
      checkedAt: new Date(lastRunTimestamp).toISOString(),
    };
  }

  lastRunTimestamp = nowMs;
  const nowIso = now.toISOString();
  const admin = createAdminClient();

  let overdueFlaggedCount = 0;
  let remindersSentCount = 0;

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // 1. OVERDUE DETECTION (checked_out bookings past end_at)
    // ──────────────────────────────────────────────────────────────────────────
    const { data: overdueBookings, error: overdueErr } = await admin
      .from("bookings")
      .select(`
        id,
        user_id,
        resource_id,
        start_at,
        end_at,
        resources:resource_id(id, name, owner_id),
        user:profiles!user_id(id, full_name, email)
      `)
      .eq("status", "checked_out")
      .lt("end_at", nowIso);

    if (overdueErr) {
      console.error("Error querying overdue bookings:", overdueErr.message);
    } else if (overdueBookings && overdueBookings.length > 0) {
      for (const b of overdueBookings as any[]) {
        // Idempotency check: has an "overdue_flagged" audit log already been logged for this booking?
        const { data: existingAudit } = await admin
          .from("audit_log")
          .select("id")
          .eq("booking_id", b.id)
          .eq("action", "overdue_flagged")
          .limit(1)
          .maybeSingle();

        if (!existingAudit) {
          const resourceName = b.resources?.name || "Equipment";
          const ownerId = b.resources?.owner_id;
          const bookerName = b.user?.full_name || b.user?.email || "Student";
          const endTimeFormatted = format(new Date(b.end_at), "h:mm a, MMM d");

          // 1. Log audit entry "overdue_flagged"
          await logAudit({
            actor: { id: null, name: "Overdue Monitor" },
            action: "overdue_flagged",
            entityType: "booking",
            entityId: b.id,
            bookingId: b.id,
            resourceId: b.resource_id,
            reason: `Reservation passed scheduled return time (${endTimeFormatted})`,
            details: {
              end_at: b.end_at,
              flagged_at: nowIso,
            },
          });

          // 2. Notify student user
          await notify(
            b.user_id,
            "⚠️ Return Overdue",
            `Your session for "${resourceName}" was scheduled to end at ${endTimeFormatted}. Please return the equipment immediately to avoid strikes.`,
            `/bookings/${b.id}`
          );

          // 3. Notify facility owner
          if (ownerId && ownerId !== b.user_id) {
            await notify(
              ownerId,
              "Equipment Return Overdue",
              `Reservation for "${resourceName}" by ${bookerName} is overdue (ended at ${endTimeFormatted}).`,
              "/handovers"
            );
          }

          overdueFlaggedCount++;
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. UPCOMING REMINDERS (approved bookings starting within window)
    // ──────────────────────────────────────────────────────────────────────────
    const fairnessSettings = await getFairnessSettings();
    const reminderMinutes = fairnessSettings.reminder_minutes_before || 60;
    const reminderWindowEnd = new Date(nowMs + reminderMinutes * 60 * 1000).toISOString();

    const { data: upcomingBookings, error: upcomingErr } = await admin
      .from("bookings")
      .select(`
        id,
        user_id,
        resource_id,
        start_at,
        end_at,
        resources:resource_id(name)
      `)
      .eq("status", "approved")
      .gt("start_at", nowIso)
      .lte("start_at", reminderWindowEnd);

    if (upcomingErr) {
      console.error("Error querying upcoming reminders:", upcomingErr.message);
    } else if (upcomingBookings && upcomingBookings.length > 0) {
      for (const b of upcomingBookings as any[]) {
        // Idempotency check: has a reminder notification already been sent to this user for this booking?
        const { data: existingNotification } = await admin
          .from("notifications")
          .select("id")
          .eq("user_id", b.user_id)
          .eq("link", `/bookings/${b.id}`)
          .ilike("title", "%Reminder%")
          .limit(1)
          .maybeSingle();

        if (!existingNotification) {
          const resourceName = b.resources?.name || "Resource";
          const startTimeFormatted = format(new Date(b.start_at), "h:mm a");
          const diffMinutes = Math.max(
            1,
            Math.round((new Date(b.start_at).getTime() - nowMs) / 60000)
          );

          await notify(
            b.user_id,
            "Upcoming Session Reminder",
            `Your booking for "${resourceName}" starts in approximately ${diffMinutes} minutes (at ${startTimeFormatted}). Please visit the facility desk for check-out.`,
            `/bookings/${b.id}`
          );

          remindersSentCount++;
        }
      }
    }
  } catch (err) {
    console.error("Exception in checkOverdueAndReminders:", err);
  }

  return {
    overdueFlaggedCount,
    remindersSentCount,
    checkedAt: nowIso,
  };
}

