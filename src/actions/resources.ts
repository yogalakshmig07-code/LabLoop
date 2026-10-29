"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ResourceUpsertSchema } from "@/lib/validations";
import { requireUser, requireRole } from "@/lib/session";
import { canManageResource } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { smartMatchResources, SmartMatchResult } from "@/lib/ai/gemini";
import { ActionResult } from "@/types/actions";
import { revalidatePath } from "next/cache";

/**
 * Searches and ranks active campus resources based on natural language intent.
 */
export async function smartMatchAction(
  query: string
): Promise<ActionResult<SmartMatchResult[]>> {
  try {
    const admin = createAdminClient();
    const { data: resources, error } = await admin
      .from("resources")
      .select("id, name, category, description, location")
      .eq("is_active", true);

    if (error || !resources) {
      return { ok: false, error: "Failed to retrieve resources for matching." };
    }

    const matches = await smartMatchResources(query, resources);
    return { ok: true, data: matches };
  } catch (err: any) {
    console.error("Error in smartMatchAction:", err);
    return { ok: false, error: err?.message || "Matching failed" };
  }
}

/**
 * Toggles a resource's active state.
 */
export async function toggleResourceActiveAction(
  resourceId: string,
  isActive: boolean
): Promise<ActionResult<void>> {
  try {
    const session = await requireUser();
    const admin = createAdminClient();

    const { data: resource, error: fetchErr } = await admin
      .from("resources")
      .select("id, owner_id, name")
      .eq("id", resourceId)
      .single();

    if (fetchErr || !resource) {
      return { ok: false, error: "Resource not found." };
    }

    const hasPerm = await canManageResource(session, resource);
    if (!hasPerm) {
      return { ok: false, error: "Unauthorized to update this resource." };
    }

    const { error: updateErr } = await admin
      .from("resources")
      .update({ is_active: isActive })
      .eq("id", resourceId);

    if (updateErr) {
      return { ok: false, error: updateErr.message };
    }

    await logAudit({
      actor: { id: session.user.id, name: session.profile.full_name || session.user.email },
      action: "resource_updated",
      entityType: "resource",
      entityId: resourceId,
      resourceId,
      reason: `Resource ${isActive ? "activated" : "deactivated"}`,
      details: { is_active: isActive },
    });

    revalidatePath("/resources");
    revalidatePath("/my-resources");
    revalidatePath(`/resources/${resourceId}`);
    return { ok: true, data: undefined };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Operation failed." };
  }
}

/**
 * Creates or updates a resource and its requirements, availability windows, and managers.
 */
export async function saveResourceAction(
  rawInput: unknown
): Promise<ActionResult<{ resourceId: string }>> {
  try {
    const session = await requireUser();

    // Only owners or admins may create or edit resources
    if (session.role !== "admin" && session.role !== "owner") {
      return { ok: false, error: "Only faculty owners or admins can manage resources." };
    }

    // Unverified owners are restricted from creating new resources
    if (session.role === "owner" && !session.profile.owner_verified) {
      return {
        ok: false,
        error: "Your faculty owner account is pending verification by campus administrators. You cannot publish resources yet.",
      };
    }

    const parseResult = ResourceUpsertSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        ok: false,
        error: parseResult.error.errors.map((e) => e.message).join(", "),
      };
    }

    const input = parseResult.data;
    const admin = createAdminClient();
    const isEditing = Boolean(input.id);

    if (isEditing && input.id) {
      const { data: existing, error: fetchErr } = await admin
        .from("resources")
        .select("id, owner_id")
        .eq("id", input.id)
        .single();

      if (fetchErr || !existing) {
        return { ok: false, error: "Resource not found." };
      }

      const hasPerm = await canManageResource(session, existing);
      if (!hasPerm) {
        return { ok: false, error: "You do not have permission to edit this resource." };
      }
    }

    // 1. Upsert resource record
    const resourcePayload = {
      name: input.name,
      category: input.category,
      location: input.location,
      description: input.description || null,
      image_path: input.image_path || null,
      is_active: input.is_active,
      requires_supervision: input.requires_supervision,
      max_duration_hours: input.max_duration_hours,
      buffer_minutes: input.buffer_minutes,
      usage_rules: input.usage_rules || null,
      deposit_note: input.deposit_note || null,
    };

    let resourceId = input.id;

    if (isEditing && resourceId) {
      const { error: updateErr } = await admin
        .from("resources")
        .update(resourcePayload)
        .eq("id", resourceId);

      if (updateErr) {
        return { ok: false, error: updateErr.message };
      }
    } else {
      const { data: newRes, error: insertErr } = await admin
        .from("resources")
        .insert({
          ...resourcePayload,
          owner_id: session.user.id,
        })
        .select("id")
        .single();

      if (insertErr || !newRes) {
        return { ok: false, error: insertErr?.message || "Failed to create resource." };
      }
      resourceId = newRes.id;
    }

    // 2. Synchronize requirements
    await admin.from("resource_requirements").delete().eq("resource_id", resourceId!);
    if (input.requirements && input.requirements.length > 0) {
      const reqRows = input.requirements.map((r) => ({
        resource_id: resourceId!,
        credential_type: r.credential_type,
        description: r.description || null,
      }));
      await admin.from("resource_requirements").insert(reqRows);
    }

    // 3. Synchronize availability windows
    await admin.from("availability_windows").delete().eq("resource_id", resourceId!);
    if (input.availability_windows && input.availability_windows.length > 0) {
      const windowRows = input.availability_windows.map((w) => ({
        resource_id: resourceId!,
        day_of_week: w.day_of_week,
        start_time: w.start_time.length === 5 ? `${w.start_time}:00` : w.start_time,
        end_time: w.end_time.length === 5 ? `${w.end_time}:00` : w.end_time,
      }));
      await admin.from("availability_windows").insert(windowRows);
    }

    // 4. Synchronize managers
    await admin.from("resource_managers").delete().eq("resource_id", resourceId!);
    if (input.manager_ids && input.manager_ids.length > 0) {
      const managerRows = input.manager_ids.map((mgrId) => ({
        resource_id: resourceId!,
        user_id: mgrId,
      }));
      await admin.from("resource_managers").insert(managerRows);
    }

    // 5. Log audit
    await logAudit({
      actor: { id: session.user.id, name: session.profile.full_name || session.user.email },
      action: isEditing ? "resource_updated" : "resource_created",
      entityType: "resource",
      entityId: resourceId,
      resourceId: resourceId,
      reason: isEditing ? "Resource details modified" : "New resource catalog entry created",
      details: { name: input.name, category: input.category },
    });

    revalidatePath("/resources");
    revalidatePath("/my-resources");
    revalidatePath(`/resources/${resourceId}`);
    return { ok: true, data: { resourceId: resourceId! } };
  } catch (err: any) {
    console.error("Error in saveResourceAction:", err);
    return { ok: false, error: err?.message || "Unexpected failure" };
  }
}

/**
 * Admin action to toggle owner verification status on profiles.
 */
export async function setUserOwnerVerifiedAction(
  userId: string,
  verified: boolean
): Promise<ActionResult<void>> {
  try {
    const session = await requireRole(["admin"]);
    const admin = createAdminClient();

    const { error } = await admin
      .from("profiles")
      .update({ owner_verified: verified })
      .eq("id", userId);

    if (error) {
      return { ok: false, error: error.message };
    }

    await logAudit({
      actor: { id: session.user.id, name: session.profile.full_name || session.user.email },
      action: "user_owner_verified_updated",
      entityType: "profile",
      entityId: userId,
      reason: `Owner verification set to ${verified}`,
      details: { owner_verified: verified },
    });

    revalidatePath("/users");
    return { ok: true, data: undefined };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Admin authorization failure" };
  }
}

