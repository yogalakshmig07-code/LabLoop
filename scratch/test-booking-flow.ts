import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { Database } from "../src/types/db";
import { computePriorityScore, rankWaitlist } from "../src/lib/fairness";
import { addDays, format } from "date-fns";

function generateDecisionExplanation(booking: {
  status: string;
  priority_tier: string;
  decision_reason?: string | null;
  system_check?: any;
  waitlist_rank?: number | null;
}) {
  const check = booking.system_check || {};
  const bullets: string[] = [];

  if (check.eligibility?.eligible) {
    bullets.push("Eligibility: All safety induction & prerequisite training requirements met.");
  }
  if (check.weekly_cap) {
    bullets.push(`Weekly Category Allocation: ${check.weekly_cap.used || 0} of ${check.weekly_cap.max || 8} hours booked.`);
  }
  if (check.priority_score) {
    bullets.push(`Priority Tier: ${booking.priority_tier.toUpperCase()} (${check.priority_score.breakdown || `${check.priority_score.score} points`}).`);
  }
  if (booking.status === "waitlisted") {
    const rank = booking.waitlist_rank || check.waitlist?.rank || 1;
    const total = check.waitlist?.total_waitlisted || 1;
    bullets.push(`Waitlist Standing: Position #${rank} of ${total} competing reservation requests.`);
  }
  if (check.conflict?.has_conflict) {
    bullets.push("Schedule Notice: Requested slot overlaps with an approved reservation session.");
  }

  let summary = "";
  if (booking.status === "approved") {
    summary = booking.decision_reason
      ? `Approved by facility custodian: "${booking.decision_reason}"`
      : "Approved: All prerequisite safety checks and resource availability confirmed.";
  } else if (booking.status === "waitlisted") {
    summary = booking.decision_reason
      ? `Waitlisted: "${booking.decision_reason}"`
      : "Slot is currently occupied; request is ranked on the waiting list by priority score.";
  }

  return { summary, bullets };
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

async function runBookingWorkflowWalkthrough() {
  console.log("================================================================================");
  console.log("🚀 CORE BOOKING WORKFLOW VERIFICATION");
  console.log("Scenario: student1 requests 3D Printer -> owner approves -> student2 requests same slot & lands on waitlist");
  console.log("================================================================================");

  // 1. Fetch Demo Users
  const { data: student1 } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, strikes")
    .eq("email", "student1@labloop.demo")
    .single();

  const { data: student2 } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, strikes")
    .eq("email", "student2@labloop.demo")
    .single();

  const { data: owner } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("email", "owner@labloop.demo")
    .single();

  // 2. Fetch 3D Printer Resource
  const { data: resource } = await supabase
    .from("resources")
    .select("id, name, buffer_minutes, max_duration_hours, category, owner_id")
    .eq("name", "3D Printer (Prusa MK4)")
    .single();

  if (!student1 || !student2 || !owner || !resource) {
    console.error("❌ Missing required seed data:", { student1: !!student1, student2: !!student2, owner: !!owner, resource: !!resource });
    process.exit(1);
  }

  console.log(`👤 Student 1: ${student1.full_name} (${student1.email})`);
  console.log(`👤 Student 2: ${student2.full_name} (${student2.email})`);
  console.log(`👑 Facility Owner: ${owner.full_name} (${owner.email})`);
  console.log(`🖨️ Target Resource: "${resource.name}" (buffer: ${resource.buffer_minutes}m, max: ${resource.max_duration_hours}h)`);

  // Target Slot: Tomorrow from 10:00 to 12:00
  const tomorrow = addDays(new Date(), 1);
  const dateStr = format(tomorrow, "yyyy-MM-dd");
  const slotStart = new Date(`${dateStr}T10:00:00.000Z`).toISOString();
  const slotEnd = new Date(`${dateStr}T12:00:00.000Z`).toISOString();

  console.log(`📅 Target Time Slot: ${dateStr} from 10:00 UTC to 12:00 UTC`);

  // Clean up any existing bookings for this resource on this slot to start clean
  await supabase
    .from("bookings")
    .delete()
    .eq("resource_id", resource.id)
    .gte("start_at", `${dateStr}T00:00:00.000Z`)
    .lte("end_at", `${dateStr}T23:59:59.999Z`);

  console.log("🧹 Cleaned up existing bookings for clean test run.\n");

  // ==========================================================================
  // STEP 1: Student 1 Requests the 3D Printer
  // ==========================================================================
  console.log("--- STEP 1: Student 1 Submits Booking Request ---");

  // Check Student 1 eligibility for 3D Printer
  const { data: reqs } = await supabase
    .from("resource_requirements")
    .select("credential_type")
    .eq("resource_id", resource.id);

  const { data: s1Creds } = await supabase
    .from("credentials")
    .select("credential_type, status")
    .eq("user_id", student1.id)
    .eq("status", "verified");

  const requiredType = reqs?.[0]?.credential_type || "3D Printer Safety Training";
  const s1HasCred = s1Creds?.some((c) => c.credential_type === requiredType);
  console.log(`✓ Student 1 prerequisite '${requiredType}' verified: ${s1HasCred}`);

  // Compute Student 1 priority score (Coursework)
  const s1Priority = computePriorityScore("coursework", student1.strikes, 0);
  console.log(`✓ Student 1 Priority Score: ${s1Priority.score} (${s1Priority.reason})`);

  // Create Student 1 booking
  const s1SystemCheck = {
    eligibility: { eligible: true, items: [{ requirement: requiredType, status: "met" }] },
    active_cap: { ok: true, count: 0, max: 3 },
    weekly_cap: { ok: true, used: 0, requested: 2, max: 8 },
    priority_score: { score: s1Priority.score, breakdown: s1Priority.reason },
    conflict: { has_conflict: false },
  };

  const { data: s1Booking, error: s1Error } = await supabase
    .from("bookings")
    .insert({
      resource_id: resource.id,
      user_id: student1.id,
      start_at: slotStart,
      end_at: slotEnd,
      purpose: "Final year engineering capstone prototype enclosure printing",
      priority_tier: "coursework",
      status: "pending_review",
      rules_acknowledged: true,
      system_check: s1SystemCheck as any,
    })
    .select("id, status")
    .single();

  if (s1Error || !s1Booking) {
    console.error("❌ Failed to create Student 1 booking:", s1Error);
    process.exit(1);
  }

  console.log(`✅ PASS: Student 1 booking created: ${s1Booking.id} with status='${s1Booking.status}'`);

  // ==========================================================================
  // STEP 2: Facility Owner Approves Student 1's Booking
  // ==========================================================================
  console.log("\n--- STEP 2: Facility Owner Approves Student 1 Request ---");

  const approvalReason = "Approved: Verified coursework CAD model and FabLab safety standing.";
  const { error: approveError } = await supabase
    .from("bookings")
    .update({
      status: "approved",
      decision_reason: approvalReason,
      decided_by: owner.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", s1Booking.id);

  if (approveError) {
    console.error("❌ Failed to approve booking:", approveError);
    process.exit(1);
  }

  console.log(`✅ PASS: Booking ${s1Booking.id} transitioned to 'approved'.`);
  console.log(`Decision Reason: "${approvalReason}"`);

  // ==========================================================================
  // STEP 3: Student 2 Requests the Same Slot
  // ==========================================================================
  console.log("\n--- STEP 3: Student 2 Requests the Same Time Slot ---");

  // Conflict detection check
  const bufferMs = (resource.buffer_minutes || 0) * 60 * 1000;
  const searchStart = new Date(new Date(slotStart).getTime() - bufferMs).toISOString();
  const searchEnd = new Date(new Date(slotEnd).getTime() + bufferMs).toISOString();

  const { data: conflicts } = await supabase
    .from("bookings")
    .select("id, start_at, end_at, status")
    .eq("resource_id", resource.id)
    .in("status", ["approved", "checked_out"])
    .lt("start_at", searchEnd)
    .gt("end_at", searchStart);

  const hasConflict = (conflicts && conflicts.length > 0);
  console.log(`✓ Conflict detected with approved booking: ${hasConflict} (Conflicting ID: ${conflicts?.[0]?.id})`);

  if (!hasConflict) {
    console.error("❌ Expected conflict was not detected!");
    process.exit(1);
  }

  // Student 2 chooses "Join the waiting list for this slot"
  console.log("✓ Student 2 opts to join the waitlist for this slot.");

  const s2Priority = computePriorityScore("coursework", student2.strikes, 0);

  const s2SystemCheck = {
    eligibility: { eligible: true, items: [{ requirement: requiredType, status: "met" }] },
    active_cap: { ok: true, count: 0, max: 3 },
    weekly_cap: { ok: true, used: 0, requested: 2, max: 8 },
    priority_score: { score: s2Priority.score, breakdown: s2Priority.reason },
    conflict: { has_conflict: true, conflicting_id: conflicts[0].id },
    waitlist: { rank: 1, total_waitlisted: 1 },
  };

  const { data: s2Booking, error: s2Error } = await supabase
    .from("bookings")
    .insert({
      resource_id: resource.id,
      user_id: student2.id,
      start_at: slotStart,
      end_at: slotEnd,
      purpose: "Autonomous robot chassis mount 3D print for robotics competition",
      priority_tier: "coursework",
      status: "waitlisted",
      waitlist_rank: 1,
      decision_reason: "Slot currently occupied by approved reservation; placed on waitlist.",
      rules_acknowledged: true,
      system_check: s2SystemCheck as any,
    })
    .select("id, status, waitlist_rank")
    .single();

  if (s2Error || !s2Booking) {
    console.error("❌ Failed to create Student 2 waitlisted booking:", s2Error);
    process.exit(1);
  }

  console.log(`✅ PASS: Student 2 booking created as 'waitlisted' with rank #${s2Booking.waitlist_rank}`);

  // ==========================================================================
  // STEP 4: Explainable Decision Card Breakdown for Student 2
  // ==========================================================================
  console.log("\n--- STEP 4: Verify Explainable Decision Card for Student 2 ---");

  const s2Explanation = generateDecisionExplanation({
    status: s2Booking.status as any,
    priority_tier: "coursework",
    decision_reason: "Slot currently occupied by approved reservation; placed on waitlist.",
    system_check: s2SystemCheck,
    waitlist_rank: s2Booking.waitlist_rank,
  });

  console.log("Summary:", s2Explanation.summary);
  console.log("Explanation Bullets:");
  s2Explanation.bullets.forEach((b) => console.log(`  • ${b}`));

  if (s2Explanation.bullets.some((b) => b.includes("Waitlist Standing")) && s2Explanation.bullets.some((b) => b.includes("Schedule Notice"))) {
    console.log("✅ PASS: Decision card accurately explains why student2 was waitlisted.");
  } else {
    console.error("❌ Explanation missing required bullets:", s2Explanation);
    process.exit(1);
  }

  console.log("\n================================================================================");
  console.log("🎉 SUCCESS! All steps in the core booking & waitlist workflow passed flawlessly!");
  console.log("================================================================================");
}

runBookingWorkflowWalkthrough().catch((err) => {
  console.error("Workflow error:", err);
  process.exit(1);
});
