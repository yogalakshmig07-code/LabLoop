"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { notify, notifyMany } from "@/lib/notify";
import { getCredentialSignedUrl } from "@/lib/credentials";
import { ActionResult } from "@/types/actions";
import { CredentialSubmitSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

/**
 * Checks if the caller has permissions to verify or reject this credential.
 */
async function canVerifyCredential(
  viewerId: string,
  viewerRole: string,
  credentialType: string
): Promise<boolean> {
  if (viewerRole === "admin") return true;

  const admin = createAdminClient();

  // Find resources where caller is owner or assigned manager
  const { data: owned } = await admin
    .from("resources")
    .select("id")
    .eq("owner_id", viewerId);

  const { data: managed } = await admin
    .from("resource_managers")
    .select("resource_id")
    .eq("user_id", viewerId);

  const resourceIds = new Set<string>();
  owned?.forEach((r) => resourceIds.add(r.id));
  managed?.forEach((m) => resourceIds.add(m.resource_id));

  if (resourceIds.size === 0) return false;

  const { data: reqs } = await admin
    .from("resource_requirements")
    .select("id")
    .in("resource_id", Array.from(resourceIds))
    .eq("credential_type", credentialType);

  return Boolean(reqs && reqs.length > 0);
}

/**
 * Uploads a student or campus member's training credential document for verification.
 */
export async function uploadCredentialAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireUser();
    const admin = createAdminClient();

    let credentialType = formData.get("credential_type") as string;
    const customType = formData.get("custom_type") as string | null;
    const expiresAt = formData.get("expires_at") as string | null;
    const file = formData.get("file") as File | null;

    if (!credentialType || credentialType.trim() === "") {
      return { ok: false, error: "Please select a credential type." };
    }

    if (credentialType === "Other") {
      if (!customType || customType.trim() === "") {
        return { ok: false, error: "Please specify the custom credential name." };
      }
      credentialType = customType.trim();
    } else {
      credentialType = credentialType.trim();
    }

    if (!file || file.size === 0) {
      return { ok: false, error: "Please select a proof document or certificate." };
    }

    if (file.size > MAX_FILE_SIZE) {
      return { ok: false, error: "File exceeds the 5MB size limit. Please upload a smaller document." };
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return { ok: false, error: "Invalid file type. Only PDF and image files (PNG, JPG, WEBP) are accepted." };
    }

    // Sanitize file name and create storage path
    const fileExt = file.name.split(".").pop() || "pdf";
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `${session.user.id}/${Date.now()}_${cleanFileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await admin.storage
      .from("credentials")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return { ok: false, error: `Upload failed: ${uploadError.message}` };
    }

    // Insert record into credentials table
    const { data: newCred, error: insertError } = await admin
      .from("credentials")
      .insert({
        user_id: session.user.id,
        credential_type: credentialType,
        file_path: storagePath,
        status: "pending",
        expires_at: expiresAt && expiresAt.trim() !== "" ? expiresAt : null,
      })
      .select("id")
      .single();

    if (insertError || !newCred) {
      return { ok: false, error: insertError?.message || "Failed to save credential record." };
    }

    // Log audit trail: "credential_submitted"
    await logAudit({
      actor: { id: session.user.id, name: session.profile.full_name || session.user.email },
      action: "credential_submitted",
      entityType: "credential",
      entityId: newCred.id,
      reason: `Uploaded proof for ${credentialType}`,
      details: { credential_type: credentialType, file_path: storagePath },
    });

    // Notify resource owner(s) and managers of resources that require that credential type
    try {
      const { data: requirements } = await admin
        .from("resource_requirements")
        .select("resource_id")
        .eq("credential_type", credentialType);

      if (requirements && requirements.length > 0) {
        const resourceIds = requirements.map((r) => r.resource_id);

        const { data: resources } = await admin
          .from("resources")
          .select("owner_id")
          .in("id", resourceIds);

        const { data: managers } = await admin
          .from("resource_managers")
          .select("user_id")
          .in("resource_id", resourceIds);

        const recipientSet = new Set<string>();
        resources?.forEach((r) => {
          if (r.owner_id && r.owner_id !== session.user.id) {
            recipientSet.add(r.owner_id);
          }
        });
        managers?.forEach((m) => {
          if (m.user_id && m.user_id !== session.user.id) {
            recipientSet.add(m.user_id);
          }
        });

        if (recipientSet.size === 0) {
          const { data: admins } = await admin
            .from("profiles")
            .select("id")
            .eq("role", "admin");
          admins?.forEach((a) => {
            if (a.id !== session.user.id) recipientSet.add(a.id);
          });
        }

        const recipientIds = Array.from(recipientSet);
        if (recipientIds.length > 0) {
          await notifyMany(
            recipientIds,
            "New Credential Verification Request",
            `${session.profile.full_name || session.user.email} submitted "${credentialType}" for verification.`,
            "/verification"
          );
        }
      }
    } catch (notifyErr) {
      console.error("Failed to notify custodians of credential upload:", notifyErr);
    }

    revalidatePath("/profile");
    revalidatePath("/verification");
    revalidatePath("/credential-verification");
    return { ok: true, data: { id: newCred.id } };
  } catch (err: any) {
    console.error("Error in uploadCredentialAction:", err);
    return { ok: false, error: err?.message || "Unexpected failure" };
  }
}

/**
 * Verifies a pending credential, optionally specifying an expiration date.
 */
export async function verifyCredentialAction(
  credentialId: string,
  expiresAt?: string,
  note?: string
): Promise<ActionResult<void>> {
  try {
    const session = await requireRole(["owner", "manager", "admin"]);
    const admin = createAdminClient();

    const { data: cred, error: fetchErr } = await admin
      .from("credentials")
      .select("id, user_id, credential_type, status")
      .eq("id", credentialId)
      .single();

    if (fetchErr || !cred) {
      return { ok: false, error: "Credential record not found." };
    }

    const authorized = await canVerifyCredential(
      session.user.id,
      session.role,
      cred.credential_type
    );

    if (!authorized) {
      return { ok: false, error: "You are not authorized to verify credentials for this category." };
    }

    const { error: updateErr } = await admin
      .from("credentials")
      .update({
        status: "verified",
        verified_by: session.user.id,
        verified_at: new Date().toISOString(),
        expires_at: expiresAt && expiresAt.trim() !== "" ? expiresAt : null,
        note: note && note.trim() !== "" ? note.trim() : null,
      })
      .eq("id", credentialId);

    if (updateErr) {
      return { ok: false, error: updateErr.message };
    }

    // Log audit: "credential_verified"
    await logAudit({
      actor: { id: session.user.id, name: session.profile.full_name || session.user.email },
      action: "credential_verified",
      entityType: "credential",
      entityId: credentialId,
      reason: `Verified ${cred.credential_type} for student`,
      details: { expires_at: expiresAt || null, note: note || null },
    });

    // Notify user
    await notify(
      cred.user_id,
      "Credential Verified",
      `Your "${cred.credential_type}" certification has been verified by lab staff.`,
      "/profile"
    );

    revalidatePath("/profile");
    revalidatePath("/verification");
    revalidatePath("/credential-verification");
    revalidatePath("/resources");
    return { ok: true, data: undefined };
  } catch (err: any) {
    console.error("Error in verifyCredentialAction:", err);
    return { ok: false, error: err?.message || "Verification failed" };
  }
}

/**
 * Rejects a pending credential. A rejection reason is mandatory.
 */
export async function rejectCredentialAction(
  credentialId: string,
  reason: string
): Promise<ActionResult<void>> {
  try {
    const session = await requireRole(["owner", "manager", "admin"]);
    const admin = createAdminClient();

    if (!reason || reason.trim() === "") {
      return { ok: false, error: "A rejection reason is required to notify the student." };
    }

    const { data: cred, error: fetchErr } = await admin
      .from("credentials")
      .select("id, user_id, credential_type, status")
      .eq("id", credentialId)
      .single();

    if (fetchErr || !cred) {
      return { ok: false, error: "Credential record not found." };
    }

    const authorized = await canVerifyCredential(
      session.user.id,
      session.role,
      cred.credential_type
    );

    if (!authorized) {
      return { ok: false, error: "You are not authorized to review this credential submission." };
    }

    const { error: updateErr } = await admin
      .from("credentials")
      .update({
        status: "rejected",
        verified_by: session.user.id,
        verified_at: new Date().toISOString(),
        note: reason.trim(),
      })
      .eq("id", credentialId);

    if (updateErr) {
      return { ok: false, error: updateErr.message };
    }

    // Log audit: "credential_rejected"
    await logAudit({
      actor: { id: session.user.id, name: session.profile.full_name || session.user.email },
      action: "credential_rejected",
      entityType: "credential",
      entityId: credentialId,
      reason: reason.trim(),
      details: { rejection_reason: reason.trim() },
    });

    // Notify user
    await notify(
      cred.user_id,
      "Credential Rejected",
      `Your "${cred.credential_type}" submission was not approved: ${reason.trim()}`,
      "/profile"
    );

    revalidatePath("/profile");
    revalidatePath("/verification");
    revalidatePath("/credential-verification");
    revalidatePath("/resources");
    return { ok: true, data: undefined };
  } catch (err: any) {
    console.error("Error in rejectCredentialAction:", err);
    return { ok: false, error: err?.message || "Rejection failed" };
  }
}

/**
 * Retrieves a temporary secure signed URL to view the uploaded proof file.
 */
export async function getCredentialViewUrlAction(
  credentialId: string
): Promise<ActionResult<string>> {
  try {
    const session = await requireUser();
    const admin = createAdminClient();

    const { data: cred, error: fetchErr } = await admin
      .from("credentials")
      .select("id, user_id, credential_type, file_path")
      .eq("id", credentialId)
      .single();

    if (fetchErr || !cred || !cred.file_path) {
      return { ok: false, error: "Credential file not found." };
    }

    // Check permissions
    const isOwner = cred.user_id === session.user.id;
    const isStaff = await canVerifyCredential(
      session.user.id,
      session.role,
      cred.credential_type
    );

    if (!isOwner && !isStaff) {
      return { ok: false, error: "You do not have permission to view this file." };
    }

    const signedUrl = await getCredentialSignedUrl(cred.file_path, 3600);
    if (!signedUrl) {
      return { ok: false, error: "Could not generate secure view URL." };
    }

    return { ok: true, data: signedUrl };
  } catch (err: any) {
    console.error("Error in getCredentialViewUrlAction:", err);
    return { ok: false, error: err?.message || "Failed to view document" };
  }
}

// Backward compatibility wrappers for previous prompts
export async function submitCredential(rawInput: unknown) {
  return uploadCredentialAction(rawInput as any);
}

export async function verifyCredential(
  credentialId: string,
  status: "verified" | "rejected",
  note?: string,
  expiresAt?: string
) {
  if (status === "verified") {
    return verifyCredentialAction(credentialId, expiresAt, note);
  } else {
    return rejectCredentialAction(credentialId, note || "Rejected by administrator");
  }
}
