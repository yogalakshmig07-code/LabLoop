import "server-only";

import { createAdminClient } from "./supabase/admin";
import { UserRole, CredentialStatus } from "@/types/db";
import { logAudit } from "./audit";

export interface PendingCredentialItem {
  id: string;
  user_id: string;
  credential_type: string;
  file_path: string | null;
  status: CredentialStatus;
  verified_by: string | null;
  verified_at: string | null;
  expires_at: string | null;
  note: string | null;
  created_at: string;
  user: {
    id: string;
    full_name: string | null;
    email: string | null;
    department: string | null;
  } | null;
}

/**
 * Server-side routine that scans verified credentials and transitions any with
 * expires_at < today to 'expired'. Run whenever credentials are loaded.
 */
export async function expireOutdatedCredentials(): Promise<number> {
  try {
    const admin = createAdminClient();
    const today = new Date().toISOString().split("T")[0];

    // Select verified credentials that have passed their expiration date
    const { data: expiredList, error } = await admin
      .from("credentials")
      .select("id, user_id, credential_type, expires_at")
      .eq("status", "verified")
      .not("expires_at", "is", null)
      .lt("expires_at", today);

    if (error) {
      console.error("Error checking expired credentials:", error.message);
      return 0;
    }

    if (!expiredList || expiredList.length === 0) {
      return 0;
    }

    const ids = expiredList.map((c) => c.id);

    const { error: updateError } = await admin
      .from("credentials")
      .update({ status: "expired" })
      .in("id", ids);

    if (updateError) {
      console.error("Failed to update expired credentials:", updateError.message);
      return 0;
    }

    // Log audit for expired items
    for (const cred of expiredList) {
      await logAudit({
        actor: { id: "system", name: "System Scheduler" },
        action: "credential_expired",
        entityType: "credential",
        entityId: cred.id,
        reason: `Credential expired on ${cred.expires_at}`,
        details: { credential_type: cred.credential_type, expires_at: cred.expires_at },
      });
    }

    return ids.length;
  } catch (err) {
    console.error("Exception in expireOutdatedCredentials:", err);
    return 0;
  }
}

/**
 * Generates a short-lived signed URL for reading a credential document from the private bucket.
 */
export async function getCredentialSignedUrl(
  filePath: string,
  expiresInSeconds: number = 3600
): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from("credentials")
      .createSignedUrl(filePath, expiresInSeconds);

    if (error || !data) {
      console.error("Error creating signed URL:", error?.message);
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    console.error("Exception in getCredentialSignedUrl:", err);
    return null;
  }
}

/**
 * Fetches distinct credential types required across all campus resources.
 */
export async function getDistinctCredentialTypes(): Promise<string[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("resource_requirements")
      .select("credential_type");

    const defaultTypes = [
      "Lab Safety Induction",
      "3D Printer Safety Training",
      "Drone Pilot Authorisation",
      "Cleanroom Protocol & PPE",
      "Laser Cutter Clearance",
    ];

    if (error || !data) {
      return defaultTypes;
    }

    const set = new Set<string>(defaultTypes);
    for (const item of data) {
      if (item.credential_type && item.credential_type.trim()) {
        set.add(item.credential_type.trim());
      }
    }

    return Array.from(set).sort();
  } catch (err) {
    console.error("Exception in getDistinctCredentialTypes:", err);
    return ["Lab Safety Induction", "3D Printer Safety Training", "Drone Pilot Authorisation"];
  }
}

/**
 * Fetches pending credentials that the current viewer is authorized to verify.
 * Admins see all. Owners/managers see those matching credentials required by resources they manage.
 */
export async function getPendingCredentialsForViewer(
  viewerId: string,
  viewerRole: UserRole
): Promise<PendingCredentialItem[]> {
  const admin = createAdminClient();
  await expireOutdatedCredentials();

  let allowedCredentialTypes: string[] | null = null;

  if (viewerRole !== "admin") {
    // 1. Get resources owned by viewer
    const { data: ownedResources } = await admin
      .from("resources")
      .select("id")
      .eq("owner_id", viewerId);

    // 2. Get resources managed by viewer
    const { data: managedResources } = await admin
      .from("resource_managers")
      .select("resource_id")
      .eq("user_id", viewerId);

    const resourceIds = new Set<string>();
    ownedResources?.forEach((r) => resourceIds.add(r.id));
    managedResources?.forEach((r) => resourceIds.add(r.resource_id));

    if (resourceIds.size === 0) {
      return [];
    }

    // 3. Get distinct credential types required by these resources
    const { data: reqs } = await admin
      .from("resource_requirements")
      .select("credential_type")
      .in("resource_id", Array.from(resourceIds));

    if (!reqs || reqs.length === 0) {
      return [];
    }

    allowedCredentialTypes = Array.from(new Set(reqs.map((r) => r.credential_type)));
  }

  // Fetch pending credentials
  let query = admin
    .from("credentials")
    .select(`
      id,
      user_id,
      credential_type,
      file_path,
      status,
      verified_by,
      verified_at,
      expires_at,
      note,
      created_at
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (allowedCredentialTypes !== null) {
    query = query.in("credential_type", allowedCredentialTypes);
  }

  const { data: credentials, error } = await query;
  if (error || !credentials) {
    console.error("Error fetching pending credentials:", error?.message);
    return [];
  }

  if (credentials.length === 0) {
    return [];
  }

  // Fetch user profiles for these credentials
  const userIds = Array.from(new Set(credentials.map((c) => c.user_id)));
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, email, department")
    .in("id", userIds);

  const profileMap = new Map<string, any>();
  profiles?.forEach((p) => profileMap.set(p.id, p));

  return credentials.map((c) => ({
    ...c,
    user: profileMap.get(c.user_id) || null,
  })) as PendingCredentialItem[];
}

