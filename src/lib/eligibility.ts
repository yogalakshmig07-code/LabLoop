import "server-only";
import { createAdminClient } from "./supabase/admin";
import { expireOutdatedCredentials } from "./credentials";

export interface RequirementCheckItem {
  requirement: string;
  status: "met" | "missing" | "pending" | "expired";
  detail: string;
}

export interface EligibilityResult {
  eligible: boolean;
  items: RequirementCheckItem[];
}

/**
 * Checks whether a given student or user meets all prerequisite training credentials
 * for reserving a specific laboratory or equipment resource.
 */
export async function checkEligibility(
  userId: string,
  resourceId: string
): Promise<EligibilityResult> {
  await expireOutdatedCredentials();
  const admin = createAdminClient();

  // 1. Fetch requirements for the target resource
  const { data: requirements, error: reqError } = await admin
    .from("resource_requirements")
    .select("credential_type, description")
    .eq("resource_id", resourceId);

  if (reqError) {
    console.error("Error fetching requirements:", reqError.message);
    return { eligible: false, items: [] };
  }

  // If the resource requires no special credentials, the user is automatically eligible
  if (!requirements || requirements.length === 0) {
    return { eligible: true, items: [] };
  }

  // 2. Fetch all credentials user has submitted
  const { data: userCreds, error: credError } = await admin
    .from("credentials")
    .select("credential_type, status, expires_at")
    .eq("user_id", userId);

  if (credError) {
    console.error("Error fetching user credentials:", credError.message);
    return { eligible: false, items: [] };
  }

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  const items: RequirementCheckItem[] = requirements.map((req) => {
    const matching = userCreds?.filter((c) => c.credential_type === req.credential_type);

    if (!matching || matching.length === 0) {
      return {
        requirement: req.credential_type,
        status: "missing",
        detail: "No certification submitted. Upload proof or complete induction.",
      };
    }

    // Check for an active, verified credential
    const verified = matching.find((c) => c.status === "verified");
    if (verified) {
      if (verified.expires_at && verified.expires_at < todayStr) {
        return {
          requirement: req.credential_type,
          status: "expired",
          detail: `Certificate expired on ${verified.expires_at}. Renewal required.`,
        };
      }
      return {
        requirement: req.credential_type,
        status: "met",
        detail: verified.expires_at
          ? `Verified (valid through ${verified.expires_at})`
          : "Verified (perpetual induction)",
      };
    }

    // Check for pending verification
    const pending = matching.find((c) => c.status === "pending");
    if (pending) {
      return {
        requirement: req.credential_type,
        status: "pending",
        detail: "Verification submitted and pending review by lab technician.",
      };
    }

    // If only rejected
    return {
      requirement: req.credential_type,
      status: "missing",
      detail: "Previous submission was rejected. Re-application required.",
    };
  });

  const eligible = items.every((i) => i.status === "met");

  return {
    eligible,
    items,
  };
}

