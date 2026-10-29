"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { UserRole } from "@/types/db";
import { ActionResult } from "@/types/actions";
import { revalidatePath } from "next/cache";

/**
 * Changes a campus user's access role (admin only).
 */
export async function updateUserRoleAction(
  userId: string,
  newRole: UserRole
): Promise<ActionResult<void>> {
  try {
    const session = await requireRole(["admin"]);
    const admin = createAdminClient();

    const validRoles: UserRole[] = ["user", "owner", "manager", "admin"];
    if (!validRoles.includes(newRole)) {
      return { ok: false, error: "Invalid role specified." };
    }

    const { data: targetUser, error: fetchErr } = await admin
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("id", userId)
      .single();

    if (fetchErr || !targetUser) {
      return { ok: false, error: "Target user not found." };
    }

    if (targetUser.role === newRole) {
      return { ok: true, data: undefined };
    }

    const { error: updateErr } = await admin
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (updateErr) {
      return { ok: false, error: updateErr.message };
    }

    // Log audit
    await logAudit({
      actor: { id: session.user.id, name: session.profile.full_name || session.user.email },
      action: "user_role_updated",
      entityType: "profile",
      entityId: userId,
      reason: `Changed role from ${targetUser.role} to ${newRole}`,
      details: { previousRole: targetUser.role, newRole },
    });

    // Notify user
    await notify(
      userId,
      "Account Role Updated",
      `Your campus account role has been updated to "${newRole.toUpperCase()}".`,
      "/dashboard"
    );

    revalidatePath("/admin/users");
    revalidatePath("/users");
    return { ok: true, data: undefined };
  } catch (err: any) {
    console.error("Error in updateUserRoleAction:", err);
    return { ok: false, error: err?.message || "Failed to update role" };
  }
}

/**
 * Toggles owner verification status on a user profile (admin only).
 */
export async function toggleUserOwnerVerifiedAction(
  userId: string,
  verified: boolean
): Promise<ActionResult<void>> {
  try {
    const session = await requireRole(["admin"]);
    const admin = createAdminClient();

    const { data: targetUser, error: fetchErr } = await admin
      .from("profiles")
      .select("id, full_name, email, owner_verified")
      .eq("id", userId)
      .single();

    if (fetchErr || !targetUser) {
      return { ok: false, error: "Target user not found." };
    }

    const { error: updateErr } = await admin
      .from("profiles")
      .update({ owner_verified: verified })
      .eq("id", userId);

    if (updateErr) {
      return { ok: false, error: updateErr.message };
    }

    // Log audit
    await logAudit({
      actor: { id: session.user.id, name: session.profile.full_name || session.user.email },
      action: "user_owner_verified_updated",
      entityType: "profile",
      entityId: userId,
      reason: `Owner verification status set to ${verified}`,
      details: { owner_verified: verified },
    });

    // Notify user
    await notify(
      userId,
      "Faculty Owner Status Updated",
      verified
        ? "Your faculty owner privileges have been verified. You can now publish resources."
        : "Your faculty owner verification has been revoked.",
      "/my-resources"
    );

    revalidatePath("/admin/users");
    revalidatePath("/users");
    return { ok: true, data: undefined };
  } catch (err: any) {
    console.error("Error in toggleUserOwnerVerifiedAction:", err);
    return { ok: false, error: err?.message || "Failed to update owner verification" };
  }
}

