import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { Database } from "../src/types/db";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

/**
 * Pure eligibility evaluator mirroring src/lib/eligibility.ts checkEligibility()
 */
async function evaluateEligibility(userId: string, resourceId: string) {
  const { data: requirements } = await supabase
    .from("resource_requirements")
    .select("credential_type, description")
    .eq("resource_id", resourceId);

  if (!requirements || requirements.length === 0) {
    return { eligible: true, items: [] };
  }

  const { data: userCreds } = await supabase
    .from("credentials")
    .select("credential_type, status, expires_at")
    .eq("user_id", userId);

  const todayStr = new Date().toISOString().split("T")[0];

  const items = requirements.map((req) => {
    const matching = userCreds?.filter((c) => c.credential_type === req.credential_type);
    if (!matching || matching.length === 0) {
      return { requirement: req.credential_type, status: "missing", detail: "Missing credential" };
    }
    const verified = matching.find((c) => c.status === "verified");
    if (verified) {
      if (verified.expires_at && verified.expires_at < todayStr) {
        return { requirement: req.credential_type, status: "expired", detail: `Expired on ${verified.expires_at}` };
      }
      return { requirement: req.credential_type, status: "met", detail: `Verified (valid through ${verified.expires_at || "perpetual"})` };
    }
    const pending = matching.find((c) => c.status === "pending");
    if (pending) {
      return { requirement: req.credential_type, status: "pending", detail: "Awaiting staff review" };
    }
    return { requirement: req.credential_type, status: "missing", detail: "Rejected or missing" };
  });

  return { eligible: items.every((i) => i.status === "met"), items };
}

/**
 * Pure pending queue fetcher mirroring src/lib/credentials.ts getPendingCredentialsForViewer()
 */
async function fetchManagerQueue(managerId: string) {
  // 1. Resources managed by this manager
  const { data: managed } = await supabase
    .from("resource_managers")
    .select("resource_id")
    .eq("user_id", managerId);

  const resourceIds = managed?.map((m) => m.resource_id) || [];
  if (resourceIds.length === 0) return [];

  // 2. Credential types required by these resources
  const { data: reqs } = await supabase
    .from("resource_requirements")
    .select("credential_type")
    .in("resource_id", resourceIds);

  const allowedTypes = Array.from(new Set(reqs?.map((r) => r.credential_type) || []));
  if (allowedTypes.length === 0) return [];

  // 3. Pending credentials
  const { data: pending } = await supabase
    .from("credentials")
    .select(`
      id,
      user_id,
      credential_type,
      file_path,
      status,
      created_at
    `)
    .eq("status", "pending")
    .in("credential_type", allowedTypes);

  return pending || [];
}

async function runTestFlow() {
  console.log("================================================================================");
  console.log("🚀 END-TO-END FLOW VERIFICATION");
  console.log("Scenario: student3 uploads 'Lab Safety Induction' -> manager verifies -> badge turns green");
  console.log("================================================================================");

  // 1. Resolve Demo Accounts
  const { data: student3 } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("email", "student3@labloop.demo")
    .single();

  const { data: manager } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("email", "manager@labloop.demo")
    .single();

  const { data: resource } = await supabase
    .from("resources")
    .select("id, name")
    .eq("name", "Soldering & SMD Rework Station")
    .single();

  if (!student3 || !manager || !resource) {
    console.error("❌ Required seed data not found:", { student3: !!student3, manager: !!manager, resource: !!resource });
    process.exit(1);
  }

  console.log(`👤 Student: ${student3.full_name} (${student3.email})`);
  console.log(`🛠️ Manager: ${manager.full_name} (${manager.email})`);
  console.log(`🔬 Target Resource: "${resource.name}" (requires "Lab Safety Induction")`);

  // Clean up student3's credentials to test from scratch
  await supabase.from("credentials").delete().eq("user_id", student3.id);
  console.log("\n🧹 Cleaned up existing credentials for student3.");

  // STEP 1: Initial State Check
  console.log("\n--- STEP 1: Initial Eligibility Check ---");
  const step1 = await evaluateEligibility(student3.id, resource.id);
  console.log("Initial evaluation:", step1);
  const req1 = step1.items.find((i) => i.requirement === "Lab Safety Induction");
  if (!step1.eligible && req1?.status === "missing") {
    console.log("✅ PASS: Student initially has missing requirement ('Action Needed' / Red Badge).");
  } else {
    console.error("❌ Unexpected initial status:", step1);
    process.exit(1);
  }

  // STEP 2: Student3 Uploads "Lab Safety Induction"
  console.log("\n--- STEP 2: Student3 Uploads Proof Document ---");
  const testStoragePath = `${student3.id}/${Date.now()}_lab_safety_certificate.pdf`;
  const fileBuffer = Buffer.from("%PDF-1.4 Mock Safety Induction Certificate for Divya M");

  const { error: uploadError } = await supabase.storage
    .from("credentials")
    .upload(testStoragePath, fileBuffer, { contentType: "application/pdf" });

  if (uploadError) {
    console.warn("Storage upload note:", uploadError.message);
  } else {
    console.log(`✓ Uploaded mock file to storage: credentials/${testStoragePath}`);
  }

  const { data: newCred, error: insertError } = await supabase
    .from("credentials")
    .insert({
      user_id: student3.id,
      credential_type: "Lab Safety Induction",
      file_path: testStoragePath,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !newCred) {
    console.error("❌ Failed to insert credential:", insertError);
    process.exit(1);
  }
  console.log(`✓ Inserted credential submission: ${newCred.id} with status='pending'`);

  // Audit log
  await supabase.from("audit_log").insert({
    actor_id: student3.id,
    actor_name: student3.full_name,
    action: "credential_submitted",
    entity_type: "credential",
    entity_id: newCred.id,
    reason: "Uploaded proof for Lab Safety Induction",
    details: { credential_type: "Lab Safety Induction", file_path: testStoragePath },
  });

  // Check eligibility during pending state
  const step2 = await evaluateEligibility(student3.id, resource.id);
  const req2 = step2.items.find((i) => i.requirement === "Lab Safety Induction");
  console.log(`Intermediate evaluation: eligible=${step2.eligible}, item status='${req2?.status}'`);
  if (!step2.eligible && req2?.status === "pending") {
    console.log("✅ PASS: Student requirement shows 'pending' ('Pending Review' / Cyan Badge).");
  } else {
    console.error("❌ Unexpected pending state:", step2);
    process.exit(1);
  }

  // STEP 3: Manager Views Credential Verification Queue
  console.log("\n--- STEP 3: Manager Views Queue (/verification) ---");
  const queue = await fetchManagerQueue(manager.id);
  const target = queue.find((c) => c.id === newCred.id);
  if (target) {
    console.log(`✅ PASS: Manager found student3's submission in their queue: "${target.credential_type}"`);
  } else {
    console.error("❌ Item not found in manager queue! Queue length:", queue.length);
    process.exit(1);
  }

  // Verify short-lived signed URL generation
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from("credentials")
    .createSignedUrl(testStoragePath, 3600);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    console.warn("⚠️ Signed URL warning:", signedUrlError?.message);
  } else {
    console.log(`✓ Signed URL generated for file preview: ${signedUrlData.signedUrl.substring(0, 70)}...`);
  }

  // STEP 4: Manager Verifies the Credential
  console.log("\n--- STEP 4: Manager Verifies the Credential ---");
  const oneYearExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { error: updateError } = await supabase
    .from("credentials")
    .update({
      status: "verified",
      verified_by: manager.id,
      verified_at: new Date().toISOString(),
      expires_at: oneYearExpiry,
      note: "Passed safety quiz and physical equipment inspection",
    })
    .eq("id", newCred.id);

  if (updateError) {
    console.error("❌ Failed to verify credential:", updateError);
    process.exit(1);
  }

  // Audit log
  await supabase.from("audit_log").insert({
    actor_id: manager.id,
    actor_name: manager.full_name,
    action: "credential_verified",
    entity_type: "credential",
    entity_id: newCred.id,
    reason: "Verified Lab Safety Induction for student",
    details: { expires_at: oneYearExpiry },
  });

  // Notification to student
  await supabase.from("notifications").insert({
    user_id: student3.id,
    title: "Credential Verified",
    body: 'Your "Lab Safety Induction" certification has been verified by lab staff.',
    link: "/profile",
  });

  console.log(`✓ Manager verified credential with expiry: ${oneYearExpiry}`);

  // STEP 5: Final Eligibility Check on the Resource Page
  console.log("\n--- STEP 5: Student Views Resource Page (/resources/[id]) ---");
  const step5 = await evaluateEligibility(student3.id, resource.id);
  console.log("Final evaluation:", step5);

  const req5 = step5.items.find((i) => i.requirement === "Lab Safety Induction");
  if (step5.eligible && req5?.status === "met") {
    console.log("================================================================================");
    console.log("🎉 SUCCESS! Student3 eligibility badge turns GREEN ('Eligible' / 'Met')!");
    console.log(`Status: Met (${req5.detail})`);
    console.log("================================================================================");
  } else {
    console.error("❌ Verification did not result in 'met' eligibility:", step5);
    process.exit(1);
  }
}

runTestFlow().catch((e) => {
  console.error("Test flow failed:", e);
  process.exit(1);
});
