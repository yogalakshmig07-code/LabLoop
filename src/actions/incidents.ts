"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { IncidentCreateSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";

export async function reportIncident(rawInput: unknown) {
  const serverSupabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await serverSupabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Authentication required." };
  }

  const parseResult = IncidentCreateSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.errors.map((e) => e.message).join(", ") };
  }

  const input = parseResult.data;
  const adminSupabase = createAdminClient();

  const { data: incident, error: insertError } = await adminSupabase
    .from("incidents")
    .insert({
      booking_id: input.booking_id || null,
      resource_id: input.resource_id,
      reported_by: user.id,
      incident_type: input.incident_type,
      severity: input.severity,
      description: input.description,
      status: "open",
    })
    .select("id")
    .single();

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  // Audit log
  await adminSupabase.from("audit_log").insert({
    actor_id: user.id,
    actor_name: user.email,
    action: "INCIDENT_REPORTED",
    entity_type: "incident",
    entity_id: incident.id,
    booking_id: input.booking_id || null,
    resource_id: input.resource_id,
    reason: input.description,
    details: { incident_type: input.incident_type, severity: input.severity },
  });

  revalidatePath("/incidents");
  return { success: true, incidentId: incident.id };
}

export async function resolveIncident(
  incidentId: string,
  resolution: string,
  applyStrike: boolean
) {
  const serverSupabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await serverSupabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Unauthorized." };
  }

  const adminSupabase = createAdminClient();
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "owner", "manager"].includes(profile.role)) {
    return { success: false, error: "Only lab owners, managers, or admins can resolve incidents." };
  }

  const { data: incident, error: incErr } = await adminSupabase
    .from("incidents")
    .select("id, booking_id, resource_id, reported_by")
    .eq("id", incidentId)
    .single();

  if (incErr || !incident) {
    return { success: false, error: "Incident not found." };
  }

  // If strike applied and incident is tied to a booking, increment the strikes on the user
  if (applyStrike && incident.booking_id) {
    const { data: booking } = await adminSupabase
      .from("bookings")
      .select("user_id")
      .eq("id", incident.booking_id)
      .single();

    if (booking?.user_id) {
      const { data: targetProfile } = await adminSupabase
        .from("profiles")
        .select("strikes")
        .eq("id", booking.user_id)
        .single();

      const newStrikes = (targetProfile?.strikes || 0) + 1;
      await adminSupabase
        .from("profiles")
        .update({ strikes: newStrikes })
        .eq("id", booking.user_id);

      await adminSupabase.from("notifications").insert({
        user_id: booking.user_id,
        title: "⚠️ Strike Applied",
        body: `A safety strike was issued due to incident resolution: ${resolution}. Total strikes: ${newStrikes}.`,
        link: "/profile",
      });
    }
  }

  // Update incident
  const { error: updateError } = await adminSupabase
    .from("incidents")
    .update({
      status: "resolved",
      resolution,
      resolved_by: user.id,
      strike_applied: applyStrike,
    })
    .eq("id", incidentId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Audit log
  await adminSupabase.from("audit_log").insert({
    actor_id: user.id,
    actor_name: profile.full_name || user.email,
    action: "INCIDENT_RESOLVED",
    entity_type: "incident",
    entity_id: incidentId,
    booking_id: incident.booking_id,
    resource_id: incident.resource_id,
    reason: resolution,
    details: { strike_applied: applyStrike },
  });

  revalidatePath("/incidents");
  return { success: true };
}

