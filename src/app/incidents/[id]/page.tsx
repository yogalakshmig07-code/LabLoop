import { requireUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ShieldAlert } from "lucide-react";
import {
  IncidentDetailView,
  IncidentDetailData,
} from "@/components/incidents/incident-detail-view";
import { ConditionGrade } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireUser();
  const admin = createAdminClient();

  // 1. Fetch incident with relationships
  const { data: incident, error } = (await admin
    .from("incidents")
    .select(`
      id,
      booking_id,
      resource_id,
      reported_by,
      incident_type,
      severity,
      description,
      ai_summary,
      status,
      resolution,
      resolved_by,
      strike_applied,
      dispute_note,
      created_at,
      resource:resources(id, name, category, location, owner_id),
      reporter:profiles!reported_by(id, full_name, email),
      resolver:profiles!resolved_by(id, full_name, email),
      booking:bookings(id, start_at, end_at, purpose, borrower:profiles!user_id(id, full_name, email, department, strikes))
    `)
    .eq("id", id)
    .maybeSingle()) as { data: any; error: any };

  if (error || !incident) {
    notFound();
  }

  // 2. Authorization check
  const isBorrower = incident.booking?.borrower?.id === session.user.id;
  const isReporter = incident.reported_by === session.user.id;
  const isAdmin = session.role === "admin";
  const isOwner = incident.resource?.owner_id === session.user.id;

  let isManager = false;
  if (!isBorrower && !isReporter && !isAdmin && !isOwner) {
    const { data: mgr } = await admin
      .from("resource_managers")
      .select("resource_id")
      .eq("resource_id", incident.resource_id)
      .eq("user_id", session.user.id)
      .maybeSingle();
    isManager = Boolean(mgr);
  }

  if (!isBorrower && !isReporter && !isAdmin && !isOwner && !isManager) {
    notFound();
  }

  const canManage = isAdmin || isOwner || isManager;

  // 3. Fetch condition reports if tied to a booking
  let checkoutReportData: any = null;
  let returnReportData: any = null;

  if (incident.booking_id) {
    const { data: conditionReports } = await admin
      .from("condition_reports")
      .select("*")
      .eq("booking_id", incident.booking_id)
      .order("created_at", { ascending: true });

    const rawCheckout = conditionReports?.find((r) => r.kind === "checkout");
    const rawReturn = conditionReports?.find((r) => r.kind === "return");

    const signPhotos = async (paths: string[] = []) => {
      const signedUrls: string[] = [];
      for (const p of paths) {
        if (!p) continue;
        const { data: s } = await admin.storage
          .from("condition-photos")
          .createSignedUrl(p, 3600);
        if (s?.signedUrl) signedUrls.push(s.signedUrl);
      }
      return signedUrls;
    };

    if (rawCheckout) {
      checkoutReportData = {
        id: rawCheckout.id,
        grade: rawCheckout.grade as ConditionGrade,
        notes: rawCheckout.notes,
        checklist: (rawCheckout.checklist as Record<string, boolean>) || {},
        photoUrls: await signPhotos(rawCheckout.photo_paths || []),
        created_at: rawCheckout.created_at,
      };
    }

    if (rawReturn) {
      returnReportData = {
        id: rawReturn.id,
        grade: rawReturn.grade as ConditionGrade,
        notes: rawReturn.notes,
        checklist: (rawReturn.checklist as Record<string, boolean>) || {},
        photoUrls: await signPhotos(rawReturn.photo_paths || []),
        created_at: rawReturn.created_at,
      };
    }
  }

  // 4. Fetch incident photos from audit_log
  const { data: reportAudit } = await admin
    .from("audit_log")
    .select("details")
    .eq("entity_id", incident.id)
    .eq("action", "incident_reported")
    .maybeSingle();

  const incidentPhotoPaths: string[] = (reportAudit?.details as any)?.photo_paths || [];
  const incidentPhotoUrls: string[] = [];
  for (const p of incidentPhotoPaths) {
    if (!p) continue;
    const { data: s } = await admin.storage
      .from("condition-photos")
      .createSignedUrl(p, 3600);
    if (s?.signedUrl) incidentPhotoUrls.push(s.signedUrl);
  }

  // 5. Fetch full audit history for incident & associated strikes/disputes
  const { data: auditRows } = await admin
    .from("audit_log")
    .select("id, action, actor_name, reason, details, created_at")
    .or(`entity_id.eq.${incident.id},booking_id.eq.${incident.booking_id || "00000000-0000-0000-0000-000000000000"}`)
    .order("created_at", { ascending: true });

  const relevantActions = [
    "incident_reported",
    "incident_under_review",
    "incident_resolved",
    "strike_applied",
    "incident_disputed",
    "strike_reversed",
    "dispute_upheld",
    "dispute_reversed",
  ];

  const auditHistory = (auditRows || []).filter((r) => relevantActions.includes(r.action));

  const detailData: IncidentDetailData = {
    id: incident.id,
    booking_id: incident.booking_id,
    resource_id: incident.resource_id,
    reported_by: incident.reported_by,
    incident_type: incident.incident_type,
    severity: incident.severity,
    description: incident.description,
    ai_summary: incident.ai_summary,
    status: incident.status,
    resolution: incident.resolution,
    resolved_by: incident.resolved_by,
    resolved_by_name: incident.resolver?.full_name || incident.resolver?.email,
    strike_applied: incident.strike_applied,
    dispute_note: incident.dispute_note,
    created_at: incident.created_at,
    resource: incident.resource,
    reporter: incident.reporter,
    booking: incident.booking,
    checkoutReport: checkoutReportData,
    returnReport: returnReportData,
    incidentPhotoUrls,
    auditHistory,
  };

  return (
    <AuthenticatedLayout>
      <div className="space-y-6 max-w-4xl mx-auto pb-12">
        <div>
          <Link
            href="/incidents"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Incident Log</span>
          </Link>
        </div>

        <IncidentDetailView
          incident={detailData}
          viewerId={session.user.id}
          viewerRole={session.role}
          canManage={canManage}
        />
      </div>
    </AuthenticatedLayout>
  );
}

