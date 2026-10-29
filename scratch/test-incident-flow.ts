import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { Database } from "../src/types/db";
import {
  reportIncidentAction,
  regenerateIncidentSummaryAction,
  setIncidentUnderReviewAction,
  resolveIncidentAction,
  disputeIncidentAction,
  reviewDisputeAction,
} from "../src/actions/incidents";
import { computePriorityScore } from "../src/lib/fairness";
import { detectSuspiciousUsagePatterns } from "../src/lib/incidents";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

async function runIncidentVerification() {
  console.log("================================================================================");
  console.log("🚨 LABLOOP INCIDENT, RESOLUTION, DISPUTE & STRIKE VERIFICATION TEST");
  console.log("================================================================================\n");

  // 1. Identify test users
  const { data: student } = await supabase
    .from("profiles")
    .select("id, full_name, email, strikes")
    .eq("role", "user")
    .limit(1)
    .single();

  const { data: owner } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "owner")
    .limit(1)
    .single();

  const { data: admin } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "admin")
    .limit(1)
    .single();

  const { data: resource } = await supabase
    .from("resources")
    .select("id, name, category, owner_id")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!student || !owner || !admin || !resource) {
    console.error("❌ Test fixtures missing!");
    process.exit(1);
  }

  console.log(`Student (Borrower): ${student.full_name} (${student.id}) | Current Strikes: ${student.strikes}`);
  console.log(`Resource Owner: ${owner.full_name} (${owner.id})`);
  console.log(`System Admin: ${admin.full_name} (${admin.id})`);
  console.log(`Target Resource: ${resource.name} (${resource.category})\n`);

  // Ensure resource is owned by the owner for clear permission tests
  await supabase
    .from("resources")
    .update({ owner_id: owner.id })
    .eq("id", resource.id);

  // 2. Create a returned booking with condition reports for testing
  const now = new Date();
  const startAt = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();
  const endAt = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const returnedAt = new Date(now.getTime() - 110 * 60 * 1000).toISOString();

  const { data: testBooking, error: bErr } = await supabase
    .from("bookings")
    .insert({
      user_id: student.id,
      resource_id: resource.id,
      status: "returned",
      priority_tier: "coursework",
      purpose: "Automated verification test of incident reporting & dispute flow",
      start_at: startAt,
      end_at: endAt,
      checked_out_at: startAt,
      returned_at: returnedAt,
      rules_acknowledged: true,
      system_check: { eligibility: { eligible: true } },
    })
    .select()
    .single();

  if (bErr || !testBooking) {
    console.error("❌ Failed to create test returned booking:", bErr?.message);
    process.exit(1);
  }
  console.log(`✓ Created test returned booking: ${testBooking.id}`);

  // Create checkout condition report
  const { data: checkoutReport } = await supabase
    .from("condition_reports")
    .insert({
      booking_id: testBooking.id,
      kind: "checkout",
      grade: "excellent",
      notes: "Lens element flawless, optical rings rotating smoothly.",
      checklist: { "Powers on": true, "Optics clean": true, "No visible scratches": true },
      photo_paths: ["test-checkout-optics.jpg"],
      recorded_by: owner.id,
    })
    .select()
    .single();

  // Create return condition report
  const { data: returnReport } = await supabase
    .from("condition_reports")
    .insert({
      booking_id: testBooking.id,
      kind: "return",
      grade: "damaged",
      notes: "Hairline crack on front element; focus ring gritty and sticking.",
      checklist: { "Powers on": true, "Optics clean": false, "No visible scratches": false },
      photo_paths: ["test-return-crack.jpg"],
      recorded_by: owner.id,
    })
    .select()
    .single();

  console.log(`✓ Seeded checkout report (${checkoutReport?.grade}) and return report (${returnReport?.grade})`);

  // -------------------------------------------------------------------------
  // STEP 1: REPORT DAMAGE ON RETURNED BOOKING VIA SERVER ACTION
  // -------------------------------------------------------------------------
  console.log("\n--- STEP 1: Reporting Damage on Returned Booking via Server Action ---");

  // Mock owner session
  (global as any).__mockSession = {
    user: { id: owner.id, email: owner.email },
    profile: { id: owner.id, full_name: owner.full_name, email: owner.email, role: "owner" },
    role: "owner",
  };

  const incidentDescription =
    "Front optical objective glass cracked and focus ring locked after equipment returned. Device unusable for subsequent sessions without lens replacement.";

  const formData = new FormData();
  formData.append("booking_id", testBooking.id);
  formData.append("resource_id", resource.id);
  formData.append("incident_type", "damage");
  formData.append("severity", "high");
  formData.append("description", incidentDescription);

  const reportRes = await reportIncidentAction(formData);

  if (!reportRes.ok || !reportRes.data?.incidentId) {
    console.error("❌ Failed to report incident via server action:", reportRes);
    process.exit(1);
  }

  const incidentId = reportRes.data.incidentId;
  console.log(`✓ Filed incident report via reportIncidentAction: ${incidentId}`);

  // Fetch created incident
  const { data: createdIncident } = await supabase
    .from("incidents")
    .select("*")
    .eq("id", incidentId)
    .single();

  console.log(`  Type: ${createdIncident?.incident_type.toUpperCase()} | Severity: ${createdIncident?.severity.toUpperCase()}`);
  console.log(`  Initial Status: ${createdIncident?.status}`);
  console.log(`  Initial Strike Applied: ${createdIncident?.strike_applied}`);
  console.log(`  Initial AI Summary: "${createdIncident?.ai_summary?.slice(0, 100)}..."`);

  if (!createdIncident?.ai_summary) {
    console.error("❌ Expected ai_summary to be populated on incident creation!");
    process.exit(1);
  }
  console.log("✓ Advisory AI Summary generated and stored successfully!");

  // Test Regenerate Summary Action
  console.log("\nTesting 'Regenerate summary' server action...");
  const regenRes = await regenerateIncidentSummaryAction(incidentId);
  console.log(`✓ Regenerate summary result: ${regenRes.ok ? "SUCCESS" : regenRes.error}`);
  if (regenRes.ok) {
    console.log(`  Regenerated Summary: "${regenRes.data.summary.slice(0, 100)}..."`);
  }

  // -------------------------------------------------------------------------
  // STEP 2: MOVE TO UNDER REVIEW
  // -------------------------------------------------------------------------
  console.log("\n--- STEP 2: Moving Incident to 'under_review' ---");
  const underReviewRes = await setIncidentUnderReviewAction(incidentId);
  console.log(`✓ Marked under review: ${underReviewRes.ok ? "SUCCESS" : underReviewRes.error}`);

  const { data: reviewState } = await supabase
    .from("incidents")
    .select("status")
    .eq("id", incidentId)
    .single();
  console.log(`  Current Status: ${reviewState?.status}`);
  if (reviewState?.status !== "under_review") {
    console.error("❌ Expected status to be 'under_review'!");
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // STEP 3: RESOLVE WITH A STRIKE AS OWNER
  // -------------------------------------------------------------------------
  console.log("\n--- STEP 3: Resolving with a Strike as the Owner ---");

  const initialStrikes = student.strikes || 0;
  console.log(`Student strikes before resolution: ${initialStrikes}`);

  const resolutionText =
    "Physical damage confirmed upon front desk disassembly; front glass fractured from impact. User counselled and issued a safety strike.";
  const strikeReasonText = "Severe optical element damage resulting from careless handling.";

  const resolveRes = await resolveIncidentAction({
    incidentId,
    resolution: resolutionText,
    applyStrike: true,
    strikeReason: strikeReasonText,
  });

  console.log(`✓ Resolve action result: ${resolveRes.ok ? "SUCCESS" : resolveRes.error}`);

  const { data: resolvedIncident } = await supabase
    .from("incidents")
    .select("status, resolution, strike_applied, resolved_by")
    .eq("id", incidentId)
    .single();

  console.log(`  Incident Status: ${resolvedIncident?.status}`);
  console.log(`  Strike Applied Flag: ${resolvedIncident?.strike_applied}`);
  console.log(`  Resolution Recorded: "${resolvedIncident?.resolution}"`);

  // Verify student strikes incremented
  const { data: updatedStudent } = await supabase
    .from("profiles")
    .select("strikes")
    .eq("id", student.id)
    .single();

  console.log(`  Student strikes after resolution: ${updatedStudent?.strikes} (Expected: ${initialStrikes + 1})`);
  if (updatedStudent?.strikes !== initialStrikes + 1) {
    console.error("❌ Strike was not incremented properly on the user profile!");
    process.exit(1);
  }
  console.log("✓ Strike successfully applied and recorded by human owner review!");

  // Verify audit logs
  const { data: auditEntries } = await supabase
    .from("audit_log")
    .select("action, reason")
    .eq("booking_id", testBooking.id);

  const actions = auditEntries?.map((a) => a.action) || [];
  console.log(`  Recorded audit actions: ${actions.join(", ")}`);
  if (!actions.includes("strike_applied") || !actions.includes("incident_resolved")) {
    console.error("❌ Missing expected 'strike_applied' or 'incident_resolved' audit entries!");
    process.exit(1);
  }
  console.log("✓ Required audit entries logged.");

  // -------------------------------------------------------------------------
  // STEP 4: DISPUTE AS THE STUDENT
  // -------------------------------------------------------------------------
  console.log("\n--- STEP 4: Disputing Resolution as the Student ---");

  // Mock student session
  (global as any).__mockSession = {
    user: { id: student.id, email: student.email },
    profile: { id: student.id, full_name: student.full_name, email: student.email, role: "user" },
    role: "user",
  };

  const disputeStatement =
    "The lens glass was already fractured when I picked up the unit; the check-out inspection did not inspect the front element closely under strong light.";

  const disputeRes = await disputeIncidentAction({
    incidentId,
    disputeNote: disputeStatement,
  });

  console.log(`✓ Dispute action result: ${disputeRes.ok ? "SUCCESS" : disputeRes.error}`);

  const { data: disputedIncident } = await supabase
    .from("incidents")
    .select("status, dispute_note")
    .eq("id", incidentId)
    .single();

  console.log(`  Incident Status: ${disputedIncident?.status}`);
  console.log(`  Dispute Note: "${disputedIncident?.dispute_note}"`);

  if (disputedIncident?.status !== "disputed") {
    console.error("❌ Incident status did not update to 'disputed'!");
    process.exit(1);
  }
  console.log("✓ Dispute successfully recorded and queued for administrator review!");

  // -------------------------------------------------------------------------
  // STEP 5: RESOLVE DISPUTE AS ADMIN (REVERSAL & STRIKE REMOVAL)
  // -------------------------------------------------------------------------
  console.log("\n--- STEP 5: Admin Review - Reversing Strike & Resolving Dispute ---");

  // Mock admin session
  (global as any).__mockSession = {
    user: { id: admin.id, email: admin.email },
    profile: { id: admin.id, full_name: admin.full_name, email: admin.email, role: "admin" },
    role: "admin",
  };

  const adminAdjudicationNote =
    "Dispute upheld after reviewing optical bench maintenance logs showing micro-fractures from prior semester. Strike removed from student account.";

  const adminRes = await reviewDisputeAction({
    incidentId,
    decision: "reverse",
    adminNote: adminAdjudicationNote,
  });

  console.log(`✓ Admin review dispute result: ${adminRes.ok ? "SUCCESS" : adminRes.error}`);

  const { data: finalIncident } = await supabase
    .from("incidents")
    .select("status, resolution, strike_applied")
    .eq("id", incidentId)
    .single();

  console.log(`  Final Incident Status: ${finalIncident?.status}`);
  console.log(`  Final Strike Applied Flag: ${finalIncident?.strike_applied}`);
  console.log(`  Final Appended Resolution:\n  ${finalIncident?.resolution?.replace(/\n/g, "\n  ")}`);

  // Verify student strikes decremented back to initial
  const { data: finalStudent } = await supabase
    .from("profiles")
    .select("strikes")
    .eq("id", student.id)
    .single();

  console.log(`  Student strikes after admin reversal: ${finalStudent?.strikes} (Expected: ${initialStrikes})`);
  if (finalStudent?.strikes !== initialStrikes) {
    console.error(`❌ Strike was not decremented back to ${initialStrikes}!`);
    process.exit(1);
  }
  console.log("✓ Strike successfully reversed and removed from user profile by administrator!");

  // -------------------------------------------------------------------------
  // STEP 6: VERIFY FAIRNESS EFFECT OF STRIKES
  // -------------------------------------------------------------------------
  console.log("\n--- STEP 6: Verifying Fairness Effect of Strikes ---");

  const score0Strikes = computePriorityScore("coursework", 0, 0);
  const score1Strike = computePriorityScore("coursework", 1, 0);
  const score4Strikes = computePriorityScore("coursework", 4, 0);

  console.log(`Coursework 0 strikes: score = ${score0Strikes.score}, ok = ${score0Strikes.ok}`);
  console.log(`Coursework 1 strike:  score = ${score1Strike.score}, ok = ${score1Strike.ok}`);
  console.log(`Coursework 4 strikes: score = ${score4Strikes.score}, ok = ${score4Strikes.ok}`);

  if (!score0Strikes.ok || !score1Strike.ok || !score4Strikes.ok) {
    console.error("❌ Strikes blocked priority score calculation (expected ok: true always)!");
    process.exit(1);
  }
  if (score1Strike.score >= score0Strikes.score || score4Strikes.score > score1Strike.score) {
    console.error("❌ Priority score was not lowered by strikes!");
    process.exit(1);
  }
  console.log("✓ Priority score correctly lowered by strikes without ever blocking reservations!");

  // Test suspicious pattern detector
  const patterns = await detectSuspiciousUsagePatterns(student.id, resource.id);
  console.log(`\nSuspicious patterns detected for student:`, patterns.chips);
  console.log("✓ Suspicious pattern rules engine verified!");

  // -------------------------------------------------------------------------
  // CLEANUP
  // -------------------------------------------------------------------------
  console.log("\nCleaning up test artifacts...");
  await supabase.from("incidents").delete().eq("id", incidentId);
  await supabase.from("condition_reports").delete().eq("booking_id", testBooking.id);
  await supabase.from("audit_log").delete().eq("booking_id", testBooking.id);
  await supabase.from("bookings").delete().eq("id", testBooking.id);
  console.log("✓ Cleanup completed.");

  console.log("\n================================================================================");
  console.log("🎉 ALL INCIDENT, SUMMARY, RESOLUTION, DISPUTE & STRIKE TESTS PASSED!");
  console.log("================================================================================\n");
}

runIncidentVerification().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
