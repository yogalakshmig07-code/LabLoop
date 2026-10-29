"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Scale,
  Sparkles,
  RefreshCw,
  Camera,
  User,
  Building,
  Calendar,
  ArrowRight,
  Flame,
  Info,
  X,
  FileText,
  Check,
  ChevronRight,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import {
  regenerateIncidentSummaryAction,
  setIncidentUnderReviewAction,
  resolveIncidentAction,
  disputeIncidentAction,
  reviewDisputeAction,
} from "@/actions/incidents";
import { useToast } from "@/components/ui/toast";
import { IncidentType, IncidentStatus, ConditionGrade } from "@/types/db";

export interface IncidentDetailData {
  id: string;
  booking_id: string | null;
  resource_id: string;
  reported_by: string;
  incident_type: IncidentType;
  severity: "low" | "medium" | "high";
  description: string;
  ai_summary: string | null;
  status: IncidentStatus;
  resolution: string | null;
  resolved_by: string | null;
  resolved_by_name?: string | null;
  strike_applied: boolean;
  dispute_note: string | null;
  created_at: string;
  resource: {
    id: string;
    name: string;
    category: string;
    location: string | null;
    owner_id: string;
  };
  reporter: {
    id: string;
    full_name: string | null;
    email: string | null;
  };
  booking?: {
    id: string;
    start_at: string;
    end_at: string;
    purpose: string | null;
    borrower: {
      id: string;
      full_name: string | null;
      email: string | null;
      department: string | null;
      strikes: number;
    };
  } | null;
  checkoutReport?: {
    id: string;
    grade: ConditionGrade;
    notes: string | null;
    checklist: Record<string, boolean>;
    photoUrls: string[];
    created_at: string;
  } | null;
  returnReport?: {
    id: string;
    grade: ConditionGrade;
    notes: string | null;
    checklist: Record<string, boolean>;
    photoUrls: string[];
    created_at: string;
  } | null;
  incidentPhotoUrls: string[];
  auditHistory: {
    id: string | number;
    action: string;
    actor_name: string | null;
    reason: string | null;
    details: any;
    created_at: string;
  }[];
}

interface IncidentDetailViewProps {
  incident: IncidentDetailData;
  viewerId: string;
  viewerRole: string;
  canManage: boolean;
}

export function IncidentDetailView({
  incident,
  viewerId,
  viewerRole,
  canManage,
}: IncidentDetailViewProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [isPending, startTransition] = useTransition();

  const [aiSummary, setAiSummary] = useState(incident.ai_summary);
  const [isRegeneratingAi, setIsRegeneratingAi] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Resolution form state
  const [resolutionText, setResolutionText] = useState("");
  const [applyStrike, setApplyStrike] = useState(false);
  const [strikeReason, setStrikeReason] = useState("");

  // Dispute form state
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeNote, setDisputeNote] = useState("");

  // Admin dispute adjudication form state
  const [adminDecision, setAdminDecision] = useState<"uphold" | "reverse">("reverse");
  const [adminNote, setAdminNote] = useState("");

  const isBorrower = incident.booking?.borrower?.id === viewerId;
  const isAdmin = viewerRole === "admin";

  const handleRegenerateAi = async () => {
    setIsRegeneratingAi(true);
    try {
      const res = await regenerateIncidentSummaryAction(incident.id);
      if (res.ok) {
        setAiSummary(res.data.summary);
        success("AI incident summary regenerated.");
      } else {
        toastError(res.error || "Failed to regenerate AI summary.");
      }
    } finally {
      setIsRegeneratingAi(false);
    }
  };

  const handleSetUnderReview = () => {
    startTransition(async () => {
      const res = await setIncidentUnderReviewAction(incident.id);
      if (res.ok) {
        success("Incident moved to formal staff review.");
        router.refresh();
      } else {
        toastError(res.error || "Failed to update status.");
      }
    });
  };

  const handleResolve = (e: React.FormEvent) => {
    e.preventDefault();
    if (resolutionText.trim().length < 5) {
      toastError("Please enter a resolution explanation (min 5 chars).");
      return;
    }

    startTransition(async () => {
      const res = await resolveIncidentAction({
        incidentId: incident.id,
        resolution: resolutionText.trim(),
        applyStrike,
        strikeReason: strikeReason.trim() || undefined,
      });

      if (res.ok) {
        success("Incident successfully resolved.");
        router.refresh();
      } else {
        toastError(res.error || "Failed to resolve incident.");
      }
    });
  };

  const handleDispute = (e: React.FormEvent) => {
    e.preventDefault();
    if (disputeNote.trim().length < 5) {
      toastError("Please provide an explanation for your dispute (min 5 chars).");
      return;
    }

    startTransition(async () => {
      const res = await disputeIncidentAction({
        incidentId: incident.id,
        disputeNote: disputeNote.trim(),
      });

      if (res.ok) {
        success("Dispute filed. Administrators have been notified.");
        setShowDisputeForm(false);
        router.refresh();
      } else {
        toastError(res.error || "Failed to submit dispute.");
      }
    });
  };

  const handleAdminAdjudicate = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminNote.trim().length < 5) {
      toastError("Administrator review rationale is required (min 5 chars).");
      return;
    }

    startTransition(async () => {
      const res = await reviewDisputeAction({
        incidentId: incident.id,
        decision: adminDecision,
        adminNote: adminNote.trim(),
      });

      if (res.ok) {
        success(
          adminDecision === "reverse"
            ? "Dispute upheld: resolution reversed and strike removed."
            : "Dispute concluded: resolution upheld."
        );
        router.refresh();
      } else {
        toastError(res.error || "Failed to adjudicate dispute.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-950/80 text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedPhoto}
              alt="Evidence zoom"
              className="max-h-[85vh] w-auto mx-auto object-contain rounded-xl"
            />
          </div>
        </div>
      )}

      {/* Disputed Alert Banner */}
      {incident.status === "disputed" && (
        <div className="p-5 rounded-2xl bg-amber-500/15 border-2 border-amber-500/50 shadow-lg shadow-amber-950/30 space-y-2">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
            <Scale className="w-5 h-5 text-amber-400 shrink-0" />
            <span>Resolution Formally Disputed by Borrower</span>
          </div>
          <p className="text-xs text-amber-200/90 leading-relaxed bg-amber-950/40 p-3 rounded-xl border border-amber-500/30 italic">
            &ldquo;{incident.dispute_note}&rdquo;
          </p>
          <p className="text-[11px] text-amber-300/80">
            A campus administrator must review the evidence below and make a binding determination to either uphold or reverse this outcome.
          </p>
        </div>
      )}

      {/* Main Status & Header Card */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700 font-semibold">
              {incident.incident_type}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                incident.severity === "high"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  : incident.severity === "medium"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
              }`}
            >
              {incident.severity} Severity
            </span>

            {incident.strike_applied && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                <Flame className="w-3 h-3" />
                1 Strike Issued
              </span>
            )}
          </div>

          <h2 className="text-xl font-bold text-white tracking-tight">
            Incident on {incident.resource.name}
          </h2>

          <p className="text-xs text-slate-400">
            Reported by <span className="text-slate-300 font-medium">{incident.reporter.full_name || incident.reporter.email}</span> on {format(new Date(incident.created_at), "EEEE, MMMM d, yyyy 'at' h:mm a")}
          </p>
        </div>

        {/* Current Status Badge */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          {incident.status === "open" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
              Status: Open
            </span>
          )}
          {incident.status === "under_review" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              Status: Under Review
            </span>
          )}
          {incident.status === "disputed" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              <Scale className="w-3.5 h-3.5 text-amber-400" />
              Status: Disputed
            </span>
          )}
          {incident.status === "resolved" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Status: Resolved
            </span>
          )}
        </div>
      </div>

      {/* Advisory AI Summary Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/30 shadow-md space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-500/20 pb-3">
          <div className="flex items-center gap-2 text-indigo-300">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Advisory Incident Summary</h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-indigo-300 uppercase px-2 py-0.5 rounded bg-indigo-500/20">
              AI-Generated Advisory
            </span>
            <button
              type="button"
              onClick={handleRegenerateAi}
              disabled={isRegeneratingAi}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegeneratingAi ? "animate-spin" : ""}`} />
              <span>Regenerate summary</span>
            </button>
          </div>
        </div>

        {aiSummary ? (
          <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-indigo-500/20">
            {aiSummary}
          </p>
        ) : (
          <p className="text-xs text-slate-500 italic">No summary generated yet.</p>
        )}

        <div className="flex items-center gap-1.5 text-[11px] text-indigo-400/90 font-medium">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span>AI-generated summary. Review the evidence before deciding.</span>
        </div>
      </div>

      {/* Description & Photo Evidence */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-400" />
          <span>Factual Incident Narrative</span>
        </h3>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
          {incident.description}
        </div>

        {/* Incident Photos */}
        {incident.incidentPhotoUrls.length > 0 && (
          <div className="space-y-2 pt-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-slate-500" />
              <span>Uploaded Photo Evidence ({incident.incidentPhotoUrls.length})</span>
            </span>
            <div className="flex flex-wrap gap-3">
              {incident.incidentPhotoUrls.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedPhoto(url)}
                  className="w-24 h-24 rounded-xl overflow-hidden border border-slate-700 hover:border-indigo-400 transition-all cursor-zoom-in group bg-slate-950"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Incident evidence photo ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Linked Booking & Resource Context */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Resource Details */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Building className="w-4 h-4 text-indigo-400" />
            <span>Target Resource Facility</span>
          </h3>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-indigo-300">
                {incident.resource.category}
              </span>
            </div>
            <h4 className="text-base font-bold text-white">{incident.resource.name}</h4>
            {incident.resource.location && (
              <p className="text-xs text-slate-400">{incident.resource.location}</p>
            )}
          </div>

          <Link
            href={`/resources/${incident.resource.id}`}
            className="inline-flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
          >
            <span>View Catalog Entry</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Booking Context */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span>Associated Reservation Session</span>
          </h3>

          {incident.booking ? (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                  <span className="text-slate-500">Scheduled:</span>
                  <span className="text-slate-200 font-mono">
                    {format(new Date(incident.booking.start_at), "MMM d, h:mm a")} -{" "}
                    {format(new Date(incident.booking.end_at), "h:mm a")}
                  </span>
                </div>

                <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                  <span className="text-slate-500">Borrower:</span>
                  <span className="text-white font-medium">
                    {incident.booking.borrower.full_name || incident.booking.borrower.email}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Active Strikes:</span>
                  <span
                    className={`font-bold ${
                      incident.booking.borrower.strikes > 0 ? "text-rose-400" : "text-emerald-400"
                    }`}
                  >
                    {incident.booking.borrower.strikes} penalty strike(s)
                  </span>
                </div>
              </div>

              <Link
                href={`/bookings/${incident.booking.id}`}
                className="inline-flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
              >
                <span>View Full Booking Record</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic p-4 rounded-xl bg-slate-950 border border-slate-800">
              This incident is not linked to a specific reservation session.
            </p>
          )}
        </div>
      </div>

      {/* Before / After Condition Reports Summary */}
      {(incident.checkoutReport || incident.returnReport) && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Scale className="w-4 h-4 text-indigo-400" />
            <span>Before vs. After Physical Inspection Records</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Check-Out Baseline */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Check-Out Baseline</span>
                </span>
                {incident.checkoutReport && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-slate-800 text-emerald-400 border border-slate-700">
                    Grade: {incident.checkoutReport.grade}
                  </span>
                )}
              </div>

              {incident.checkoutReport ? (
                <div className="space-y-2 text-xs">
                  {incident.checkoutReport.notes && (
                    <p className="text-slate-300 italic bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      &ldquo;{incident.checkoutReport.notes}&rdquo;
                    </p>
                  )}

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Checklist</span>
                    {Object.entries(incident.checkoutReport.checklist).map(([item, passed]) => (
                      <div key={item} className="flex items-center gap-1.5 text-slate-300 text-[11px]">
                        {passed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        )}
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>

                  {incident.checkoutReport.photoUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {incident.checkoutReport.photoUrls.map((url, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedPhoto(url)}
                          className="w-14 h-14 rounded-lg overflow-hidden border border-slate-700"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="Checkout photo" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No check-out report on file.</p>
              )}
            </div>

            {/* Return Inspection */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-indigo-400" />
                  <span>Return Inspection</span>
                </span>
                {incident.returnReport && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-slate-800 text-amber-400 border border-slate-700">
                    Grade: {incident.returnReport.grade}
                  </span>
                )}
              </div>

              {incident.returnReport ? (
                <div className="space-y-2 text-xs">
                  {incident.returnReport.notes && (
                    <p className="text-slate-300 italic bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      &ldquo;{incident.returnReport.notes}&rdquo;
                    </p>
                  )}

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Checklist</span>
                    {Object.entries(incident.returnReport.checklist).map(([item, passed]) => {
                      const wasPassed = incident.checkoutReport?.checklist?.[item] !== false;
                      const regressed = wasPassed && !passed;
                      return (
                        <div
                          key={item}
                          className={`flex items-center gap-1.5 text-[11px] ${
                            regressed ? "text-rose-300 font-bold" : "text-slate-300"
                          }`}
                        >
                          {passed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          )}
                          <span>
                            {item} {regressed ? "(Regressed)" : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {incident.returnReport.photoUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {incident.returnReport.photoUrls.map((url, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedPhoto(url)}
                          className="w-14 h-14 rounded-lg overflow-hidden border border-slate-700"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="Return photo" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No return report on file.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resolution Details (If Resolved) */}
      {incident.resolution && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Official Custodian Resolution</span>
            </h3>
            {incident.resolved_by_name && (
              <span className="text-xs text-slate-400">
                Adjudicated by: <span className="text-white font-medium">{incident.resolved_by_name}</span>
              </span>
            )}
          </div>

          <p className="text-sm text-slate-200 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800 whitespace-pre-wrap">
            {incident.resolution}
          </p>

          {/* Dispute Button for Borrower if not already disputed */}
          {isBorrower && incident.status === "resolved" && !showDisputeForm && (
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDisputeForm(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors"
              >
                <Scale className="w-4 h-4" />
                <span>Dispute Resolution / Penalty</span>
              </button>
            </div>
          )}

          {/* Borrower Dispute Submission Form */}
          {showDisputeForm && (
            <form onSubmit={handleDispute} className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-3 mt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-amber-400" />
                  <span>File a Formal Dispute</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowDisputeForm(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Explain clearly why you believe this resolution or strike was issued in error. An impartial campus administrator will review the physical inspection evidence.
              </p>

              <textarea
                rows={3}
                required
                value={disputeNote}
                onChange={(e) => setDisputeNote(e.target.value)}
                placeholder="State your reasons for disputing this determination..."
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  disabled={isPending || disputeNote.trim().length < 5}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all disabled:opacity-50"
                >
                  {isPending ? "Filing Dispute..." : "Submit Dispute to Administrators"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Admin Dispute Adjudication Panel (Admins Only, when Disputed) */}
      {isAdmin && incident.status === "disputed" && (
        <form onSubmit={handleAdminAdjudicate} className="p-6 rounded-2xl bg-amber-950/20 border-2 border-amber-500/40 space-y-4">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-base border-b border-amber-500/20 pb-3">
            <Scale className="w-5 h-5 text-amber-400" />
            <span>Administrator Dispute Adjudication</span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            As a campus system administrator, review the borrower&apos;s dispute statement, check-out/return baseline comparison, and photos before issuing a binding outcome.
          </p>

          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Adjudication Decision
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAdminDecision("reverse")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  adminDecision === "reverse"
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold ring-1 ring-emerald-500/30"
                    : "bg-slate-900 border-slate-800 text-slate-400"
                }`}
              >
                <div className="text-xs font-bold text-white">Reverse Resolution</div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Uphold borrower dispute; remove strike penalty from account.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAdminDecision("uphold")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  adminDecision === "uphold"
                    ? "bg-rose-500/20 border-rose-500 text-rose-300 font-bold ring-1 ring-rose-500/30"
                    : "bg-slate-900 border-slate-800 text-slate-400"
                }`}
              >
                <div className="text-xs font-bold text-white">Uphold Original Resolution</div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Reject dispute; maintain resolution and strike status.
                </div>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Administrator Rationale &amp; Findings <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="State the factual basis for this dispute determination..."
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isPending || adminNote.trim().length < 5}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all disabled:opacity-50"
            >
              {isPending ? "Submitting Determination..." : "Apply Final Dispute Determination"}
            </button>
          </div>
        </form>
      )}

      {/* Staff Resolution Form (Human decisions only) */}
      {canManage && ["open", "under_review"].includes(incident.status) && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-indigo-400" />
              <span>Custodian Action &amp; Resolution</span>
            </h3>

            {incident.status === "open" && (
              <button
                type="button"
                onClick={handleSetUnderReview}
                disabled={isPending}
                className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-colors"
              >
                Mark Under Review
              </button>
            )}
          </div>

          <form onSubmit={handleResolve} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Resolution Rationale &amp; Corrective Action <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={resolutionText}
                onChange={(e) => setResolutionText(e.target.value)}
                placeholder="Explain the inspection findings, counseling given, repairs needed, or why this incident is considered closed..."
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Strike application checkbox */}
            {incident.booking && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyStrike}
                    onChange={(e) => setApplyStrike(e.target.checked)}
                    className="w-4 h-4 rounded mt-0.5 border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-rose-400" />
                      <span>Apply a safety strike penalty to this user</span>
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Penalties are always applied by a person. Strikes lower waitlist priority; they never block reservations automatically.
                    </p>
                  </div>
                </label>

                {applyStrike && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-300">
                      Strike Reasoning Note (Sent to borrower)
                    </label>
                    <input
                      type="text"
                      value={strikeReason}
                      onChange={(e) => setStrikeReason(e.target.value)}
                      placeholder="e.g., Unreported physical casing fracture due to careless packing"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500 italic">
                Penalties are always applied by a person.
              </span>

              <button
                type="submit"
                disabled={isPending || resolutionText.trim().length < 5}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-all"
              >
                {isPending ? "Recording Resolution..." : "Resolve Incident"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Activity History / Audit Trail */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" />
          <span>Incident Chain of Custody &amp; Activity History</span>
        </h3>

        {incident.auditHistory.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No activity entries recorded yet.</p>
        ) : (
          <div className="space-y-3 relative pl-6 border-l-2 border-slate-800">
            {incident.auditHistory.map((item, idx) => (
              <div key={item.id || idx} className="relative group">
                <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-indigo-500/20" />
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">
                      {item.action.replace(/_/g, " ").toUpperCase()}
                    </span>
                    <time className="text-[11px] font-mono text-slate-500">
                      {format(new Date(item.created_at), "MMM d, h:mm a")}
                    </time>
                  </div>

                  <p className="text-slate-400 text-[11px]">
                    Actor: <span className="text-slate-300 font-medium">{item.actor_name || "System"}</span>
                  </p>

                  {item.reason && (
                    <p className="text-slate-300 italic pt-0.5">&ldquo;{item.reason}&rdquo;</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
