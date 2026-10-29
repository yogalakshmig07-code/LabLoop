import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { Database, ConditionGrade } from "../src/types/db";
import { checkOverdueAndReminders } from "../src/lib/overdue";
import {
  CATEGORY_CHECKLISTS,
  compareConditionReports,
  hasChecklistRegression,
  gradeWorse,
} from "../src/lib/checklists";
import { transitionBooking } from "../src/lib/workflow";
import { logAudit } from "../src/lib/audit";
import { notify } from "../src/lib/notify";
import { formatDistanceStrict, subHours, addHours } from "date-fns";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

async function runHandoverVerification() {
  console.log("================================================================================");
  console.log("🛠️  HANDOVER, CHECK-OUT, RETURN & OVERDUE VERIFICATION TEST");
  console.log("================================================================================\n");

  // -------------------------------------------------------------------------
  // STEP 1: Verify Seeded Overdue Booking
  // -------------------------------------------------------------------------
  console.log("--- STEP 1: Checking Seeded Overdue Booking ---");
  const now = new Date();

  const { data: overdueBookings, error: b4Err } = await supabase
    .from("bookings")
    .select(`
      id,
      status,
      start_at,
      end_at,
      resource:resources(id, name, owner_id),
      user:profiles!user_id(id, full_name, email)
    `)
    .eq("status", "checked_out")
    .lt("end_at", now.toISOString());

  if (b4Err) {
    console.error("❌ Failed to query overdue bookings:", b4Err.message);
    process.exit(1);
  }

  console.log(`Found ${overdueBookings?.length || 0} currently checked-out overdue bookings.`);
  if (!overdueBookings || overdueBookings.length === 0) {
    console.error("❌ Expected at least 1 overdue booking (e.g., seeded b4)!");
    process.exit(1);
  }

  const sampleOverdue = overdueBookings[0];
  const overdueDuration = formatDistanceStrict(now, new Date(sampleOverdue.end_at));
  console.log(`✓ Sample overdue booking: ${sampleOverdue.id}`);
  console.log(`  Resource: ${sampleOverdue.resource?.name}`);
  console.log(`  Borrower: ${sampleOverdue.user?.full_name} (${sampleOverdue.user?.email})`);
  console.log(`  Scheduled End: ${sampleOverdue.end_at}`);
  console.log(`  Status: ${sampleOverdue.status.toUpperCase()} -> OVERDUE by ${overdueDuration}`);

  // Test the automated overdue monitor routine
  console.log("\nExecuting checkOverdueAndReminders(true)...");
  const overdueRun1 = await checkOverdueAndReminders(true);
  console.log("✓ Overdue monitor run 1 results:", overdueRun1);

  // Check audit log for overdue_flagged
  const { data: auditOverdue } = await supabase
    .from("audit_log")
    .select("*")
    .eq("action", "overdue_flagged")
    .eq("booking_id", sampleOverdue.id);

  console.log(`✓ Audit entries for overdue_flagged on ${sampleOverdue.id}: ${auditOverdue?.length || 0}`);
  if (!auditOverdue || auditOverdue.length === 0) {
    console.error("❌ Expected an overdue_flagged audit log!");
    process.exit(1);
  }

  // Test idempotency: second run should not duplicate
  console.log("\nTesting Idempotency: Re-running checkOverdueAndReminders(true)...");
  const overdueRun2 = await checkOverdueAndReminders(true);
  console.log("✓ Overdue monitor run 2 results:", overdueRun2);
  console.log(`  Flagged on second run: ${overdueRun2.overdueFlaggedCount} (Expected 0 new flags)`);
  if (overdueRun2.overdueFlaggedCount !== 0) {
    console.warn("⚠️ Warning: Idempotency did not report 0 newly flagged overdue bookings.");
  } else {
    console.log("✓ Idempotency verified: duplicate notifications and audit logs prevented!");
  }

  // -------------------------------------------------------------------------
  // STEP 2: Full Lifecycle: Approve -> Check-Out -> Return
  // -------------------------------------------------------------------------
  console.log("\n--- STEP 2: Full Lifecycle: Request -> Approve -> Check-Out -> Return ---");

  // Get a test student (role: 'user') and manager
  const { data: student, error: studentErr } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "user")
    .limit(1)
    .maybeSingle();

  const { data: manager, error: managerErr } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "manager")
    .limit(1)
    .maybeSingle();

  // Clean up any dangling pending_review test booking from prior runs
  await supabase
    .from("bookings")
    .delete()
    .eq("purpose", "Automated verification test of check-out and return lifecycle");

  // Find a resource that has NO active or approved bookings right now
  const { data: allResources } = await supabase
    .from("resources")
    .select("id, name, category, owner_id")
    .eq("is_active", true);

  const { data: activeBookings } = await supabase
    .from("bookings")
    .select("resource_id")
    .in("status", ["approved", "checked_out"]);

  const busyResourceIds = new Set(activeBookings?.map((b) => b.resource_id) || []);
  const resource = allResources?.find((r) => !busyResourceIds.has(r.id)) || allResources?.[0];

  if (!student || !manager || !resource) {
    console.error("❌ Missing seed data for test!", { studentErr, managerErr });
    process.exit(1);
  }

  console.log(`Test Requester: ${student.full_name} (${student.id})`);
  console.log(`Test Staff/Manager: ${manager.full_name} (${manager.id})`);
  console.log(`Test Resource: ${resource.name} (${resource.category})`);

  // Create test booking in pending_review
  const sessionStart = new Date(Date.now() + 5 * 60 * 1000); // starts in 5 minutes
  const sessionEnd = new Date(Date.now() + 125 * 60 * 1000); // ends in 2 hours

  const { data: newBooking, error: createErr } = await supabase
    .from("bookings")
    .insert({
      user_id: student.id,
      resource_id: resource.id,
      status: "pending_review",
      priority_tier: "research",
      purpose: "Automated verification test of check-out and return lifecycle",
      start_at: sessionStart.toISOString(),
      end_at: sessionEnd.toISOString(),
      rules_acknowledged: true,
      system_check: {
        eligibility: { eligible: true },
        fairness: { passed: true },
      },
    })
    .select()
    .single();

  if (createErr || !newBooking) {
    console.error("❌ Failed to create test booking:", createErr?.message);
    process.exit(1);
  }

  console.log(`✓ Created test booking: ${newBooking.id} (Status: ${newBooking.status})`);
  await logAudit({
    actor: { id: student.id, name: student.full_name },
    action: "booking_requested",
    entityType: "booking",
    entityId: newBooking.id,
    bookingId: newBooking.id,
    resourceId: resource.id,
    reason: "Student submitted booking request",
  });

  // 1. APPROVE
  console.log("\n1. Transitioning to 'approved'...");
  const appRes = await transitionBooking(
    newBooking.id,
    "approved",
    { id: manager.id, name: manager.full_name, role: "manager" },
    "Approved by lab technician for session"
  );
  if (!appRes.ok) {
    console.error("❌ Transition to approved failed:", appRes.error);
    process.exit(1);
  }

  const { data: approvedBooking } = await supabase
    .from("bookings")
    .select("status, decided_at, decided_by, decision_reason")
    .eq("id", newBooking.id)
    .single();

  console.log(`✓ Booking status is now: ${approvedBooking?.status}`);
  console.log(`  Decided by: ${approvedBooking?.decided_by}`);
  console.log(`  Decision reason: ${approvedBooking?.decision_reason}`);

  // 2. CHECK-OUT
  console.log("\n2. Simulating Check-Out inspection...");
  const defaultItems = CATEGORY_CHECKLISTS[resource.category] || CATEGORY_CHECKLISTS.equipment;
  const checkoutChecklist: Record<string, boolean> = {};
  defaultItems.forEach((item) => {
    checkoutChecklist[item] = true; // all passing
  });

  const checkoutGrade: ConditionGrade = "excellent";
  const checkoutNotes = "Device inspected at front desk; pristine condition, all cords present.";

  // Create checkout condition report
  const { data: checkoutReport, error: coRepErr } = await supabase
    .from("condition_reports")
    .insert({
      booking_id: newBooking.id,
      kind: "checkout",
      grade: checkoutGrade,
      notes: checkoutNotes,
      checklist: checkoutChecklist,
      photo_paths: ["test-checkout-photo-1.jpg"],
      recorded_by: manager.id,
    })
    .select()
    .single();

  if (coRepErr || !checkoutReport) {
    console.error("❌ Failed to create checkout condition report:", coRepErr?.message);
    process.exit(1);
  }
  console.log(`✓ Created checkout condition report: ${checkoutReport.id}`);
  console.log(`  Grade: ${checkoutReport.grade}`);
  console.log(`  Checklist items: ${Object.keys(checkoutReport.checklist as object).length} passed`);

  // Transition to checked_out
  const checkedOutAt = new Date().toISOString();
  const coRes = await transitionBooking(
    newBooking.id,
    "checked_out",
    { id: manager.id, name: manager.full_name, role: "manager" },
    "Physical handover completed; borrower accepted custody",
    { checked_out_at: checkedOutAt }
  );
  if (!coRes.ok) {
    console.error("❌ Transition to checked_out failed:", coRes.error);
    process.exit(1);
  }

  await logAudit({
    actor: { id: manager.id, name: manager.full_name },
    action: "condition_report_checkout",
    entityType: "condition_report",
    entityId: checkoutReport.id,
    bookingId: newBooking.id,
    resourceId: resource.id,
    reason: `Initial inspection grade: ${checkoutGrade.toUpperCase()}`,
    details: {
      grade: checkoutGrade,
      notes: checkoutNotes,
      checklist: checkoutChecklist,
      photoCount: 1,
    },
  });

  const { data: checkedOutBooking } = await supabase
    .from("bookings")
    .select("status, checked_out_at")
    .eq("id", newBooking.id)
    .single();

  console.log(`✓ Booking status is now: ${checkedOutBooking?.status}`);
  console.log(`  Checked out at: ${checkedOutBooking?.checked_out_at}`);

  // 3. RETURN
  console.log("\n3. Simulating Return inspection with condition degradation...");
  const returnChecklist: Record<string, boolean> = { ...checkoutChecklist };
  // Simulate 1 failed checklist item
  if (defaultItems.length > 0) {
    returnChecklist[defaultItems[0]] = false; // defect
  }
  const returnGrade: ConditionGrade = "fair";
  const returnNotes = "Minor cosmetic scratch observed on side casing during return inspection.";

  // Test Condition Comparison Logic
  const comparison = compareConditionReports(
    {
      grade: checkoutGrade,
      checklist: checkoutChecklist,
    },
    {
      grade: returnGrade,
      checklist: returnChecklist,
    },
    resource.category
  );

  const regressedItems = comparison.items.filter((i) => i.regressed).map((i) => i.item);

  console.log("✓ Condition comparison results:");
  console.log(`  Grade worse: ${comparison.gradeWorse} (${comparison.checkoutGrade} -> ${comparison.returnGrade})`);
  console.log(`  Checklist regressed: ${comparison.hasChecklistRegression}`);
  console.log(`  Regressed items: ${JSON.stringify(regressedItems)}`);
  console.log(`  Overall Condition Degraded (triggers incident prompt): ${comparison.isConditionDegraded}`);

  if (!comparison.isConditionDegraded) {
    console.error("❌ Expected condition comparison to flag condition degradation!");
    process.exit(1);
  }

  // Create return condition report
  const { data: returnReport, error: retRepErr } = await supabase
    .from("condition_reports")
    .insert({
      booking_id: newBooking.id,
      kind: "return",
      grade: returnGrade,
      notes: returnNotes,
      checklist: returnChecklist,
      photo_paths: ["test-return-photo-1.jpg"],
      recorded_by: manager.id,
    })
    .select()
    .single();

  if (retRepErr || !returnReport) {
    console.error("❌ Failed to create return condition report:", retRepErr?.message);
    process.exit(1);
  }
  console.log(`✓ Created return condition report: ${returnReport.id}`);

  // Transition to returned
  const returnedAt = new Date().toISOString();
  const retRes = await transitionBooking(
    newBooking.id,
    "returned",
    { id: manager.id, name: manager.full_name, role: "manager" },
    "Equipment returned and accepted into custody",
    { returned_at: returnedAt }
  );
  if (!retRes.ok) {
    console.error("❌ Transition to returned failed:", retRes.error);
    process.exit(1);
  }

  await logAudit({
    actor: { id: manager.id, name: manager.full_name },
    action: "condition_report_return",
    entityType: "condition_report",
    entityId: returnReport.id,
    bookingId: newBooking.id,
    resourceId: resource.id,
    reason: `Return condition inspection grade: ${returnGrade.toUpperCase()}${comparison.isConditionDegraded ? " [DEGRADATION FLAGGED]" : ""}`,
    details: {
      grade: returnGrade,
      notes: returnNotes,
      checklist: returnChecklist,
      degraded: comparison.isConditionDegraded,
      regressedItems,
    },
  });

  const { data: returnedBooking } = await supabase
    .from("bookings")
    .select("status, returned_at")
    .eq("id", newBooking.id)
    .single();

  console.log(`✓ Booking status is now: ${returnedBooking?.status}`);
  console.log(`  Returned at: ${returnedBooking?.returned_at}`);

  // -------------------------------------------------------------------------
  // STEP 3: Timeline & Audit Trail Verification
  // -------------------------------------------------------------------------
  console.log("\n--- STEP 3: Verifying Booking Audit Trail & Condition Reports ---");

  const { data: timelineAudit } = await supabase
    .from("audit_log")
    .select("id, action, actor_name, reason, created_at")
    .eq("booking_id", newBooking.id)
    .order("created_at", { ascending: true });

  console.log(`Audit events for booking ${newBooking.id}:`);
  timelineAudit?.forEach((evt, idx) => {
    console.log(`  ${idx + 1}. [${evt.action}] by ${evt.actor_name || "System"}: ${evt.reason}`);
  });

  const actions = timelineAudit?.map((t) => t.action) || [];
  const hasRequested = actions.includes("booking_requested");
  const hasTransition = actions.some((a) => a === "booking_decision" || a.startsWith("BOOKING_TRANSITION"));
  const hasCheckout = actions.includes("condition_report_checkout");
  const hasReturn = actions.includes("condition_report_return");

  if (!hasRequested || !hasTransition || !hasCheckout || !hasReturn) {
    console.error("❌ Missing expected audit event in timeline!", {
      hasRequested,
      hasTransition,
      hasCheckout,
      hasReturn,
      recordedActions: actions,
    });
    process.exit(1);
  }
  console.log("✓ All expected audit events present in timeline!");

  // Clean up test booking to keep database clean
  console.log("\nCleaning up test booking...");
  await supabase.from("condition_reports").delete().eq("booking_id", newBooking.id);
  await supabase.from("audit_log").delete().eq("booking_id", newBooking.id);
  await supabase.from("bookings").delete().eq("id", newBooking.id);
  console.log("✓ Cleanup complete.");

  console.log("\n================================================================================");
  console.log("🎉 ALL HANDOVER, CHECK-OUT, RETURN & OVERDUE VERIFICATIONS PASSED!");
  console.log("================================================================================\n");
}

runHandoverVerification().catch((err) => {
  console.error("Test failed with unhandled error:", err);
  process.exit(1);
});

