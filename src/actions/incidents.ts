"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { generateIncidentSummary, IncidentSummaryContext } from "@/lib/ai/gemini";
import { ActionResult } from "@/types/actions";
import { IncidentType, IncidentStatus } from "@/types/db";
import { revalidatePath } from "next/cache";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Graceful no-op when executed outside of an active HTTP server request (e.g. CLI tests)
  }
}

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

/**
 * Creates a new incident report associated with a booking and resource.
 * Accessible to both the borrower and resource custodians.
 */
export async function reportIncidentAction(
  formData: FormData
): Promise<ActionResult<{ incidentId: string }>> {
  try {
    const session = await requireUser();
    const admin = createAdminClient();

    const bookingId = (formData.get("booking_id") as string) || null;
    const incidentType = formData.get("incident_type") as IncidentType;
    const severity = (formData.get("severity") as "low" | "medium" | "high") || "medium";
    const description = (formData.get("description") as string)?.trim() || "";

    if (!description || description.length < 10) {
      return { ok: false, error: "Please provide a detailed incident description (min 10 characters)." };
    }

    if (!incidentType) {
      return { ok: false, error: "Incident classification type is required." };
    }

    // 1. Fetch booking & resource to determine resource_id and permissions
    let resourceId = formData.get("resource_id") as string;
    let resourceName = "Equipment";
    let resourceOwnerId: string | null = null;
    let borrowerId: string | null = null;
    let resourceCategory = "equipment";

    let checkoutReport: any = null;
    let returnReport: any = null;

    if (bookingId) {
      const { data: booking, error: bErr } = (await admin
        .from("bookings")
        .select(`
          id,
          user_id,
          resource_id,
          resource:resources(id, name, category, owner_id)
        `)
        .eq("id", bookingId)
        .maybeSingle()) as { data: any; error: any };

      if (bErr || !booking) {
        return { ok: false, error: "Referenced reservation could not be found." };
      }

      borrowerId = booking.user_id;
      resourceId = booking.resource?.id || booking.resource_id;
      resourceName = booking.resource?.name || "Equipment";
      resourceCategory = booking.resource?.category || "equipment";
      resourceOwnerId = booking.resource?.owner_id || null;

      // Check permission: Must be the borrower, resource owner, manager, or admin
      const isBorrower = session.user.id === borrowerId;
      const isAdmin = session.role === "admin";
      const isOwner = session.user.id === resourceOwnerId;

      let isManager = false;
      if (!isBorrower && !isAdmin && !isOwner) {
        const { data: mgr } = await admin
          .from("resource_managers")
          .select("resource_id")
          .eq("resource_id", resourceId)
          .eq("user_id", session.user.id)
          .maybeSingle();
        isManager = Boolean(mgr);
      }

      if (!isBorrower && !isAdmin && !isOwner && !isManager) {
        return { ok: false, error: "You are not authorized to report an incident for this reservation." };
      }

      // Fetch condition reports for AI context
      const { data: reports } = await admin
        .from("condition_reports")
        .select("*")
        .eq("booking_id", bookingId);

      checkoutReport = reports?.find((r) => r.kind === "checkout");
      returnReport = reports?.find((r) => r.kind === "return");
    } else {
      if (!resourceId) {
        return { ok: false, error: "Target resource must be specified." };
      }
      const { data: res } = await admin
        .from("resources")
        .select("id, name, category, owner_id")
        .eq("id", resourceId)
        .maybeSingle();
      if (res) {
        resourceName = res.name;
        resourceCategory = res.category;
        resourceOwnerId = res.owner_id;
      }
    }

    // 2. Process optional photo uploads (1 to 4 photos)
    const photoFiles = formData.getAll("photos") as File[];
    const validPhotos = photoFiles.filter((f) => f && f.size > 0);

    if (validPhotos.length > 4) {
      return { ok: false, error: "Maximum 4 evidence photos allowed." };
    }

    const uploadedPaths: string[] = [];
    const timestamp = Date.now();

    for (let i = 0; i < validPhotos.length; i++) {
      const photo = validPhotos[i];
      if (photo.size > MAX_PHOTO_SIZE) {
        return { ok: false, error: `Photo "${photo.name}" exceeds the 5MB size limit.` };
      }
      if (!ALLOWED_MIME_TYPES.includes(photo.type)) {
        return { ok: false, error: `Unsupported image format: ${photo.type}. Please use JPG, PNG, or WEBP.` };
      }

      const ext = photo.name.split(".").pop() || "jpg";
      const safeName = `${timestamp}-incident-${i + 1}.${ext}`;
      const storagePath = `incidents/${timestamp}/${safeName}`;

      const arrayBuffer = await photo.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadErr } = await admin.storage
        .from("condition-photos")
        .upload(storagePath, buffer, {
          contentType: photo.type,
          upsert: true,
        });

      if (uploadErr) {
        console.error("Storage upload failed for incident photo:", uploadErr);
        return { ok: false, error: `Failed to upload photo evidence: ${uploadErr.message}` };
      }

      uploadedPaths.push(storagePath);
    }

    // 3. Generate advisory AI Summary using Gemini (with fallback)
    const aiContext: IncidentSummaryContext = {
      incidentType,
      severity,
      description,
      resourceName,
      resourceCategory,
      checkoutGrade: checkoutReport?.grade || null,
      checkoutNotes: checkoutReport?.notes || null,
      checkoutChecklist: checkoutReport?.checklist || null,
      returnGrade: returnReport?.grade || null,
      returnNotes: returnReport?.notes || null,
      returnChecklist: returnReport?.checklist || null,
    };

    const aiSummary = await generateIncidentSummary(aiContext);

    // 4. Insert incident record
    const { data: newIncident, error: insertErr } = await admin
      .from("incidents")
      .insert({
        booking_id: bookingId,
        resource_id: resourceId,
        reported_by: session.user.id,
        incident_type: incidentType,
        severity,
        description,
        ai_summary: aiSummary,
        status: "open",
        strike_applied: false,
      })
      .select("id")
      .single();

    if (insertErr || !newIncident) {
      console.error("Failed to insert incident record:", insertErr);
      return { ok: false, error: insertErr?.message || "Failed to record incident." };
    }

    // 5. Write to audit_log
    await logAudit({
      actor: { id: session.user.id, name: session.profile.full_name },
      action: "incident_reported",
      entityType: "incident",
      entityId: newIncident.id,
      bookingId: bookingId || null,
      resourceId,
      reason: `${incidentType.toUpperCase()} incident filed (${severity} severity)`,
      details: {
        incident_type: incidentType,
        severity,
        description,
        photo_paths: uploadedPaths,
        ai_summary: aiSummary,
      },
    });

    // 6. Notifications
    const reporterName = session.profile.full_name || session.user.email || "A user";
    const incidentNoticeTitle = `Incident Reported: ${resourceName}`;
    const incidentNoticeBody = `${reporterName} reported a ${severity}-severity ${incidentType} issue: "${description.slice(0, 80)}${description.length > 80 ? "..." : ""}"`;

    // If student reported: notify owner and managers
    if (session.user.id === borrowerId) {
      if (resourceOwnerId) {
        await notify(resourceOwnerId, incidentNoticeTitle, incidentNoticeBody, `/incidents/${newIncident.id}`);
      }
      const { data: managers } = await admin
        .from("resource_managers")
        .select("user_id")
        .eq("resource_id", resourceId);

      for (const m of managers || []) {
        if (m.user_id !== session.user.id) {
          await notify(m.user_id, incidentNoticeTitle, incidentNoticeBody, `/incidents/${newIncident.id}`);
        }
      }
    } else {
      // If staff reported: notify student borrower and owner
      if (borrowerId) {
        await notify(borrowerId, incidentNoticeTitle, incidentNoticeBody, `/incidents/${newIncident.id}`);
      }
      if (resourceOwnerId && resourceOwnerId !== session.user.id) {
        await notify(resourceOwnerId, incidentNoticeTitle, incidentNoticeBody, `/incidents/${newIncident.id}`);
      }
    }

    safeRevalidate("/incidents");
    if (bookingId) {
      safeRevalidate(`/bookings/${bookingId}`);
    }

    return { ok: true, data: { incidentId: newIncident.id } };
  } catch (err: any) {
    console.error("reportIncidentAction error:", err);
    return { ok: false, error: err?.message || "Incident reporting failed." };
  }
}

/**
 * Regenerates the advisory AI summary using Gemini on demand.
 */
export async function regenerateIncidentSummaryAction(
  incidentId: string
): Promise<ActionResult<{ summary: string }>> {
  try {
    await requireUser();
    const admin = createAdminClient();

    const { data: incident, error: incErr } = (await admin
      .from("incidents")
      .select(`
        id,
        booking_id,
        resource_id,
        incident_type,
        severity,
        description,
        resource:resources(id, name, category)
      `)
      .eq("id", incidentId)
      .maybeSingle()) as { data: any; error: any };

    if (incErr || !incident) {
      return { ok: false, error: "Incident record not found." };
    }

    let checkoutReport: any = null;
    let returnReport: any = null;

    if (incident.booking_id) {
      const { data: reports } = await admin
        .from("condition_reports")
        .select("*")
        .eq("booking_id", incident.booking_id);

      checkoutReport = reports?.find((r) => r.kind === "checkout");
      returnReport = reports?.find((r) => r.kind === "return");
    }

    const aiContext: IncidentSummaryContext = {
      incidentType: incident.incident_type,
      severity: incident.severity,
      description: incident.description,
      resourceName: incident.resource?.name || "Equipment",
      resourceCategory: incident.resource?.category || "equipment",
      checkoutGrade: checkoutReport?.grade || null,
      checkoutNotes: checkoutReport?.notes || null,
      checkoutChecklist: checkoutReport?.checklist || null,
      returnGrade: returnReport?.grade || null,
      returnNotes: returnReport?.notes || null,
      returnChecklist: returnReport?.checklist || null,
    };

    const newSummary = await generateIncidentSummary(aiContext);

    await admin
      .from("incidents")
      .update({ ai_summary: newSummary })
      .eq("id", incidentId);

    safeRevalidate(`/incidents/${incidentId}`);
    return { ok: true, data: { summary: newSummary } };
  } catch (err: any) {
    console.error("regenerateIncidentSummaryAction error:", err);
    return { ok: false, error: err?.message || "Failed to regenerate AI summary." };
  }
}

/**
 * Moves an incident into 'under_review' status.
 */
export async function setIncidentUnderReviewAction(
  incidentId: string
): Promise<ActionResult> {
  try {
    const session = await requireRole(["owner", "manager", "admin"]);
    const admin = createAdminClient();

    const { error } = await admin
      .from("incidents")
      .update({ status: "under_review" })
      .eq("id", incidentId);

    if (error) {
      return { ok: false, error: error.message };
    }

    await logAudit({
      actor: { id: session.user.id, name: session.profile.full_name },
      action: "incident_under_review",
      entityType: "incident",
      entityId: incidentId,
      reason: "Custodian marked incident under formal staff review",
    });

    safeRevalidate(`/incidents/${incidentId}`);
    safeRevalidate("/incidents");
    return { ok: true, data: undefined };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Failed to update incident status." };
  }
}

/**
 * Resolves an incident with human decision-making only.
 * Optionally applies a strike penalty with explicit human reasoning.
 */
export async function resolveIncidentAction(params: {
  incidentId: string;
  resolution: string;
  applyStrike: boolean;
  strikeReason?: string;
}): Promise<ActionResult> {
  try {
    const session = await requireRole(["owner", "manager", "admin"]);
    const admin = createAdminClient();

    const { incidentId, resolution, applyStrike, strikeReason } = params;

    if (!resolution || resolution.trim().length < 5) {
      return { ok: false, error: "Please enter a substantive resolution explanation (min 5 chars)." };
    }

    // 1. Fetch incident with booking & borrower details
    const { data: incident, error: incErr } = (await admin
      .from("incidents")
      .select(`
        id,
        booking_id,
        resource_id,
        status,
        strike_applied,
        booking:bookings(id, user_id),
        resource:resources(name)
      `)
      .eq("id", incidentId)
      .maybeSingle()) as { data: any; error: any };

    if (incErr || !incident) {
      return { ok: false, error: "Incident not found." };
    }

    const borrowerId = incident.booking?.user_id;
    const resourceName = incident.resource?.name || "Equipment";

    // 2. Handle strike application (never automatic, strictly manual)
    if (applyStrike && borrowerId) {
      // Fetch current strikes
      const { data: borrowerProfile } = await admin
        .from("profiles")
        .select("strikes, full_name, email")
        .eq("id", borrowerId)
        .single();

      const strikesBefore = borrowerProfile?.strikes || 0;
      const strikesAfter = strikesBefore + 1;

      await admin
        .from("profiles")
        .update({ strikes: strikesAfter })
        .eq("id", borrowerId);

      // Log strike audit
      await logAudit({
        actor: { id: session.user.id, name: session.profile.full_name },
        action: "strike_applied",
        entityType: "profile",
        entityId: borrowerId,
        bookingId: incident.booking_id,
        resourceId: incident.resource_id,
        reason: strikeReason || resolution,
        details: {
          incident_id: incidentId,
          strikes_before: strikesBefore,
          strikes_after: strikesAfter,
          human_adjudicator: session.profile.full_name || session.user.email,
        },
      });

      // Notify borrower
      await notify(
        borrowerId,
        "Account Strike Issued",
        `A strike was applied to your account following review of the incident on "${resourceName}". Rationale: "${strikeReason || resolution}". Note: Strikes lower waitlist priority; they never block you automatically.`,
        `/profile`
      );
    }

    // 3. Update incident record to 'resolved'
    const { error: updateErr } = await admin
      .from("incidents")
      .update({
        status: "resolved",
        resolution: resolution.trim(),
        resolved_by: session.user.id,
        strike_applied: Boolean(applyStrike),
      })
      .eq("id", incidentId);

    if (updateErr) {
      return { ok: false, error: updateErr.message };
    }

    // 4. Log audit log
    await logAudit({
      actor: { id: session.user.id, name: session.profile.full_name },
      action: "incident_resolved",
      entityType: "incident",
      entityId: incidentId,
      bookingId: incident.booking_id,
      resourceId: incident.resource_id,
      reason: resolution.trim(),
      details: {
        strike_applied: Boolean(applyStrike),
        resolved_by: session.user.id,
      },
    });

    // 5. Notify borrower if applicable
    if (borrowerId) {
      await notify(
        borrowerId,
        "Incident Resolved",
        `The incident report for "${resourceName}" has been resolved: "${resolution.trim()}"`,
        `/incidents/${incidentId}`
      );
    }

    safeRevalidate(`/incidents/${incidentId}`);
    safeRevalidate("/incidents");
    return { ok: true, data: undefined };
  } catch (err: any) {
    console.error("resolveIncidentAction error:", err);
    return { ok: false, error: err?.message || "Failed to resolve incident." };
  }
}

/**
 * Allows the involved borrower to dispute an incident resolution or strike penalty.
 */
export async function disputeIncidentAction(params: {
  incidentId: string;
  disputeNote: string;
}): Promise<ActionResult> {
  try {
    const session = await requireUser();
    const admin = createAdminClient();

    const { incidentId, disputeNote } = params;

    if (!disputeNote || disputeNote.trim().length < 5) {
      return { ok: false, error: "Please provide a clear statement explaining the basis for your dispute (min 5 chars)." };
    }

    // 1. Fetch incident & verify permission (must be booking borrower)
    const { data: incident, error: incErr } = (await admin
      .from("incidents")
      .select(`
        id,
        booking_id,
        resource_id,
        status,
        strike_applied,
        booking:bookings(user_id),
        resource:resources(name, owner_id)
      `)
      .eq("id", incidentId)
      .maybeSingle()) as { data: any; error: any };

    if (incErr || !incident) {
      return { ok: false, error: "Incident not found." };
    }

    const borrowerId = incident.booking?.user_id;
    if (borrowerId !== session.user.id && session.role !== "admin") {
      return { ok: false, error: "Only the borrower involved in this incident may file a dispute." };
    }

    // 2. Transition incident to 'disputed'
    const { error: updateErr } = await admin
      .from("incidents")
      .update({
        status: "disputed",
        dispute_note: disputeNote.trim(),
      })
      .eq("id", incidentId);

    if (updateErr) {
      return { ok: false, error: updateErr.message };
    }

    // 3. Log audit
    await logAudit({
      actor: { id: session.user.id, name: session.profile.full_name },
      action: "incident_disputed",
      entityType: "incident",
      entityId: incidentId,
      bookingId: incident.booking_id,
      resourceId: incident.resource_id,
      reason: disputeNote.trim(),
      details: {
        dispute_note: disputeNote.trim(),
        strike_applied: incident.strike_applied,
      },
    });

    // 4. Notify owner & administrators
    const resourceName = incident.resource?.name || "Equipment";
    const studentName = session.profile.full_name || session.user.email || "Student";
    const title = `Incident Resolution Disputed: ${resourceName}`;
    const body = `${studentName} has formally disputed the resolution: "${disputeNote.trim()}"`;

    if (incident.resource?.owner_id) {
      await notify(incident.resource.owner_id, title, body, `/incidents/${incidentId}`);
    }

    // Also notify all admins
    const { data: admins } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    for (const a of admins || []) {
      await notify(a.id, `[Admin Review] ${title}`, body, `/incidents/${incidentId}`);
    }

    safeRevalidate(`/incidents/${incidentId}`);
    safeRevalidate("/incidents");
    return { ok: true, data: undefined };
  } catch (err: any) {
    console.error("disputeIncidentAction error:", err);
    return { ok: false, error: err?.message || "Failed to submit dispute." };
  }
}

/**
 * Administrator adjudication for disputed incidents:
 * Can either uphold the resolution or reverse it (and remove the strike).
 */
export async function reviewDisputeAction(params: {
  incidentId: string;
  decision: "uphold" | "reverse";
  adminNote: string;
}): Promise<ActionResult> {
  try {
    const session = await requireRole(["admin"]);
    const admin = createAdminClient();

    const { incidentId, decision, adminNote } = params;

    if (!adminNote || adminNote.trim().length < 5) {
      return { ok: false, error: "Administrator review notes are required (min 5 chars)." };
    }

    // 1. Fetch incident with borrower
    const { data: incident, error: incErr } = (await admin
      .from("incidents")
      .select(`
        id,
        booking_id,
        resource_id,
        resolution,
        strike_applied,
        dispute_note,
        booking:bookings(user_id),
        resource:resources(name)
      `)
      .eq("id", incidentId)
      .maybeSingle()) as { data: any; error: any };

    if (incErr || !incident) {
      return { ok: false, error: "Incident not found." };
    }

    const borrowerId = incident.booking?.user_id;
    const resourceName = incident.resource?.name || "Equipment";

    let strikeReversed = false;

    // 2. If reversing decision and a strike was applied, decrement strikes
    if (decision === "reverse" && incident.strike_applied && borrowerId) {
      const { data: borrowerProfile } = await admin
        .from("profiles")
        .select("strikes")
        .eq("id", borrowerId)
        .single();

      const strikesBefore = borrowerProfile?.strikes || 0;
      const strikesAfter = Math.max(0, strikesBefore - 1);

      await admin
        .from("profiles")
        .update({ strikes: strikesAfter })
        .eq("id", borrowerId);

      strikeReversed = true;

      await logAudit({
        actor: { id: session.user.id, name: session.profile.full_name },
        action: "strike_reversed",
        entityType: "profile",
        entityId: borrowerId,
        bookingId: incident.booking_id,
        resourceId: incident.resource_id,
        reason: adminNote.trim(),
        details: {
          incident_id: incidentId,
          strikes_before: strikesBefore,
          strikes_after: strikesAfter,
        },
      });
    }

    // 3. Update incident status to 'resolved' with dispute outcome appended
    const updatedResolution = `${incident.resolution || "Resolved"}\n\n[Admin Dispute Outcome: ${decision === "uphold" ? "Resolution Upheld" : "Resolution Reversed"}] — ${adminNote.trim()}`;

    const { error: updateErr } = await admin
      .from("incidents")
      .update({
        status: "resolved",
        resolution: updatedResolution,
        strike_applied: decision === "reverse" ? false : incident.strike_applied,
      })
      .eq("id", incidentId);

    if (updateErr) {
      return { ok: false, error: updateErr.message };
    }

    // 4. Log dispute outcome audit
    await logAudit({
      actor: { id: session.user.id, name: session.profile.full_name },
      action: decision === "uphold" ? "dispute_upheld" : "dispute_reversed",
      entityType: "incident",
      entityId: incidentId,
      bookingId: incident.booking_id,
      resourceId: incident.resource_id,
      reason: adminNote.trim(),
      details: {
        decision,
        admin_note: adminNote.trim(),
        strike_reversed: strikeReversed,
      },
    });

    // 5. Notify borrower
    if (borrowerId) {
      const outcomeTitle =
        decision === "reverse"
          ? "Dispute Upheld: Strike Removed"
          : "Dispute Decision: Resolution Upheld";

      const outcomeBody =
        decision === "reverse"
          ? `An administrator reviewed your dispute for "${resourceName}" and reversed the penalty: "${adminNote.trim()}". ${strikeReversed ? "Your account strike has been removed." : ""}`
          : `An administrator reviewed your dispute for "${resourceName}" and upheld the original resolution: "${adminNote.trim()}".`;

      await notify(borrowerId, outcomeTitle, outcomeBody, `/incidents/${incidentId}`);
    }

    safeRevalidate(`/incidents/${incidentId}`);
    safeRevalidate("/incidents");
    return { ok: true, data: undefined };
  } catch (err: any) {
    console.error("reviewDisputeAction error:", err);
    return { ok: false, error: err?.message || "Failed to adjudicate dispute." };
  }
}

// Backward-compatibility aliases
export const reportIncident = reportIncidentAction;
export const resolveIncident = async (incidentId: string, resolution: string, applyStrike: boolean) =>
  resolveIncidentAction({ incidentId, resolution, applyStrike });
