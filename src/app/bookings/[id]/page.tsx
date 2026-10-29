import { requireUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  CalendarClock,
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Timer,
  User,
  Info,
  Building,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { format, formatDistanceStrict } from "date-fns";
import { generateDecisionExplanation } from "@/lib/bookings";
import { CancelBookingButton } from "@/components/bookings/cancel-booking-button";
import { ExtensionRequestForm } from "@/components/bookings/extension-request-form";
import {
  BookingTimeline,
  TimelineAuditEntry,
  TimelineConditionReport,
} from "@/components/bookings/booking-timeline";
import { BookingStatus, PriorityTier, ConditionGrade } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireUser();
  const admin = createAdminClient();

  const { data: booking, error } = (await admin
    .from("bookings")
    .select(`
      id,
      user_id,
      resource_id,
      status,
      priority_tier,
      purpose,
      start_at,
      end_at,
      decision_reason,
      decided_by,
      decided_at,
      system_check,
      waitlist_rank,
      rules_acknowledged,
      checked_out_at,
      returned_at,
      ext_requested_end_at,
      ext_status,
      created_at,
      resource:resources(id, name, category, location, image_path, max_duration_hours, usage_rules, buffer_minutes, owner_id),
      decider:profiles!decided_by(id, full_name, email)
    `)
    .eq("id", id)
    .maybeSingle()) as { data: any; error: any };

  if (error || !booking) {
    notFound();
  }

  // Authorization check: Both the user and the resource's owner/managers (and admin) can see it, nobody else.
  const isRequester = booking.user_id === session.user.id;
  const isAdmin = session.role === "admin";
  const isResourceOwner = booking.resource?.owner_id === session.user.id;

  let isResourceManager = false;
  if (!isRequester && !isAdmin && !isResourceOwner) {
    const { data: mgr } = await admin
      .from("resource_managers")
      .select("resource_id")
      .eq("resource_id", booking.resource_id)
      .eq("user_id", session.user.id)
      .maybeSingle();
    isResourceManager = Boolean(mgr);
  }

  if (!isRequester && !isAdmin && !isResourceOwner && !isResourceManager) {
    notFound();
  }

  const isStaff = isAdmin || isResourceOwner || isResourceManager;

  // Fetch audit log entries for timeline
  const { data: auditEntries } = (await admin
    .from("audit_log")
    .select("id, action, actor_id, actor_name, entity_type, reason, details, created_at")
    .or(`booking_id.eq.${id},entity_id.eq.${id}`)
    .order("created_at", { ascending: true })) as { data: TimelineAuditEntry[] | null; error: any };

  // Fetch condition reports (check-out and return)
  const { data: conditionReports } = (await admin
    .from("condition_reports")
    .select("*")
    .eq("booking_id", id)
    .order("created_at", { ascending: true })) as { data: any[] | null; error: any };

  // Pre-sign all condition photos
  const allPhotoPaths: string[] = [];
  conditionReports?.forEach((cr) => {
    if (Array.isArray(cr.photo_paths)) {
      allPhotoPaths.push(...cr.photo_paths);
    }
  });

  const photoUrlMap: Record<string, string> = {};
  for (const path of allPhotoPaths) {
    if (!path) continue;
    const { data: signed } = await admin.storage
      .from("condition-photos")
      .createSignedUrl(path, 3600);
    if (signed?.signedUrl) {
      photoUrlMap[path] = signed.signedUrl;
    }
  }

  const timelineReports: TimelineConditionReport[] = (conditionReports || []).map((cr) => ({
    id: cr.id,
    booking_id: cr.booking_id,
    kind: cr.kind as "checkout" | "return",
    grade: cr.grade as ConditionGrade,
    notes: cr.notes,
    checklist: (cr.checklist as Record<string, boolean>) || {},
    photo_paths: cr.photo_paths || [],
    photoUrls: photoUrlMap,
    recorded_by: cr.recorded_by,
    created_at: cr.created_at,
  }));

  const start = new Date(booking.start_at);
  const end = new Date(booking.end_at);
  const durationStr = formatDistanceStrict(end, start);

  // Generate plain-language explainable decision breakdown
  const explanation = generateDecisionExplanation({
    status: booking.status as BookingStatus,
    priority_tier: booking.priority_tier as PriorityTier,
    decision_reason: booking.decision_reason,
    system_check: booking.system_check,
    waitlist_rank: booking.waitlist_rank,
  });

  const getStatusDisplay = (status: BookingStatus) => {
    switch (status) {
      case "checked_out":
        return {
          title: "Session Active (Checked Out)",
          color: "emerald",
          icon: <Timer className="w-5 h-5 animate-pulse text-emerald-400" />,
        };
      case "approved":
        return {
          title: "Reservation Confirmed",
          color: "indigo",
          icon: <CheckCircle2 className="w-5 h-5 text-indigo-400" />,
        };
      case "waitlisted":
        return {
          title: `Waitlisted ${booking.waitlist_rank ? `(Position #${booking.waitlist_rank})` : ""}`,
          color: "amber",
          icon: <Clock className="w-5 h-5 text-amber-400" />,
        };
      case "pending_review":
        return {
          title: "Pending Staff Review",
          color: "cyan",
          icon: <Clock className="w-5 h-5 text-cyan-400" />,
        };
      case "returned":
        return {
          title: "Completed & Returned",
          color: "slate",
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
        };
      case "rejected":
        return {
          title: "Reservation Declined",
          color: "rose",
          icon: <XCircle className="w-5 h-5 text-rose-400" />,
        };
      case "cancelled":
        return {
          title: "Reservation Cancelled",
          color: "slate",
          icon: <RotateCcw className="w-5 h-5 text-slate-500" />,
        };
    }
  };

  const statusInfo = getStatusDisplay(booking.status as BookingStatus);

  return (
    <AuthenticatedLayout>
      <div className="space-y-6 max-w-4xl mx-auto pb-12">
        <div>
          <Link
            href="/bookings"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to My Bookings</span>
          </Link>
        </div>

        {/* Status Header Banner */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
              {statusInfo.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">
                  {booking.status.toUpperCase()}
                </span>
                <span className="text-xs text-slate-500">
                  ID: {booking.id.slice(0, 8)}
                </span>
              </div>
              <h1 className="text-xl font-bold text-white mt-0.5">{statusInfo.title}</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {/* Staff Handover Fast Actions */}
            {isStaff && booking.status === "approved" && (
              <Link
                href={`/bookings/${booking.id}/checkout`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Start Check-Out</span>
              </Link>
            )}

            {isStaff && booking.status === "checked_out" && (
              <Link
                href={`/bookings/${booking.id}/return`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Process Return</span>
              </Link>
            )}

            {/* Cancel action */}
            {["pending_review", "waitlisted", "approved"].includes(booking.status) && (
              <CancelBookingButton
                bookingId={booking.id}
                isApproved={booking.status === "approved"}
                startAt={booking.start_at}
              />
            )}

            {/* Extension action if checked out */}
            {booking.status === "checked_out" && (
              <ExtensionRequestForm
                bookingId={booking.id}
                currentEndAt={booking.end_at}
              />
            )}

            {/* Report Incident Action */}
            <Link
              href={`/bookings/${booking.id}/incident`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 text-xs font-semibold shadow-sm transition-colors"
            >
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Report Incident</span>
            </Link>
          </div>
        </div>

        {/* Explainable Decisions: "Why this decision?" Card */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/30 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-indigo-500/20 pb-3">
            <div className="flex items-center gap-2 text-indigo-400">
              <HelpCircle className="w-5 h-5" />
              <h2 className="text-base font-bold text-white">Why This Decision?</h2>
            </div>
            <span className="text-[11px] font-mono text-indigo-300 uppercase px-2 py-0.5 rounded bg-indigo-500/20">
              Explainable AI &amp; Fair Rules
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-indigo-500/20 text-sm font-medium text-slate-200">
            {explanation.summary}
          </div>

          {booking.decider?.full_name && (
            <p className="text-xs text-slate-400">
              Reviewed by: <span className="text-white font-medium">{booking.decider.full_name}</span>{" "}
              {booking.decided_at ? `on ${format(new Date(booking.decided_at), "MMM d, yyyy h:mm a")}` : ""}
            </p>
          )}

          <div className="space-y-2 pt-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Automated Fair Schedule Evaluation:
            </h3>
            <ul className="space-y-2">
              {explanation.bullets.map((bullet, idx) => (
                <li
                  key={idx}
                  className="text-xs text-slate-300 flex items-start gap-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60"
                >
                  <span className="text-indigo-400 font-bold shrink-0 mt-0.5">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Reservation Information & Resource Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Reservation Details */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>Time &amp; Session Specifications</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-500">Scheduled Date:</span>
                <span className="font-semibold text-white">{format(start, "EEEE, MMMM d, yyyy")}</span>
              </div>

              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-500">Reserved Interval:</span>
                <span className="font-mono text-slate-200">
                  {format(start, "h:mm a")} - {format(end, "h:mm a")} ({durationStr})
                </span>
              </div>

              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-500">Declared Priority:</span>
                <span className="font-semibold uppercase text-indigo-300">{booking.priority_tier}</span>
              </div>

              <div className="space-y-1 pt-1">
                <span className="text-slate-500">Declared Purpose:</span>
                <p className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 leading-relaxed italic">
                  &ldquo;{booking.purpose}&rdquo;
                </p>
              </div>
            </div>
          </div>

          {/* Target Resource */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Building className="w-4 h-4 text-indigo-400" />
                <span>Reserved Facility / Equipment</span>
              </h3>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-indigo-300">
                    {booking.resource?.category}
                  </span>
                  <span className="text-xs text-slate-500">Max {booking.resource?.max_duration_hours}h</span>
                </div>
                <h4 className="text-base font-bold text-white">{booking.resource?.name}</h4>
                {booking.resource?.location && (
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span>{booking.resource.location}</span>
                  </p>
                )}
              </div>

              {booking.resource?.usage_rules && (
                <div className="text-[11px] text-slate-400 space-y-1">
                  <span className="font-semibold text-slate-300">Facility Usage Guidelines:</span>
                  <p className="line-clamp-3">{booking.resource.usage_rules}</p>
                </div>
              )}
            </div>

            <Link
              href={`/resources/${booking.resource?.id}`}
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
            >
              <span>View Resource Catalog Entry</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Vertical Audit Trail & Life Cycle Timeline */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-6">
          <BookingTimeline
            entries={auditEntries || []}
            conditionReports={timelineReports}
          />
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
