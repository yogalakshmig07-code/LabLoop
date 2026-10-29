"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import {
  CalendarClock,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  User,
  Bot,
  Info,
  Timer,
  AlertCircle,
  X,
} from "lucide-react";
import { ConditionGrade } from "@/types/db";

export interface TimelineAuditEntry {
  id: string;
  action: string;
  actor_id?: string | null;
  actor_name?: string | null;
  entity_type?: string;
  reason?: string | null;
  details?: any;
  created_at: string;
}

export interface TimelineConditionReport {
  id: string;
  booking_id: string;
  kind: "checkout" | "return";
  grade: ConditionGrade;
  notes?: string | null;
  checklist?: Record<string, boolean>;
  photo_paths: string[];
  photoUrls?: Record<string, string>;
  recorded_by?: string;
  created_at: string;
}

interface BookingTimelineProps {
  entries: TimelineAuditEntry[];
  conditionReports?: TimelineConditionReport[];
}

export function BookingTimeline({ entries, conditionReports = [] }: BookingTimelineProps) {
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const toggleDetails = (id: string) => {
    setExpandedDetails((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getActionConfig = (action: string) => {
    switch (action) {
      case "booking_requested":
        return {
          label: "Reservation Requested",
          icon: <CalendarClock className="w-4 h-4 text-cyan-400" />,
          dotColor: "bg-cyan-500 ring-cyan-500/30",
          badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
        };
      case "booking_decision":
      case "booking_approved":
      case "BOOKING_TRANSITION_APPROVED":
        return {
          label: "Reservation Approved",
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
          dotColor: "bg-emerald-500 ring-emerald-500/30",
          badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        };
      case "booking_rejected":
      case "BOOKING_TRANSITION_REJECTED":
        return {
          label: "Reservation Rejected",
          icon: <XCircle className="w-4 h-4 text-rose-400" />,
          dotColor: "bg-rose-500 ring-rose-500/30",
          badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        };
      case "booking_waitlisted":
      case "BOOKING_TRANSITION_WAITLISTED":
        return {
          label: "Added to Waitlist",
          icon: <Clock className="w-4 h-4 text-amber-400" />,
          dotColor: "bg-amber-500 ring-amber-500/30",
          badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        };
      case "booking_auto_promoted":
        return {
          label: "Auto-Promoted from Waitlist",
          icon: <CheckCircle2 className="w-4 h-4 text-indigo-400" />,
          dotColor: "bg-indigo-500 ring-indigo-500/30",
          badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
        };
      case "BOOKING_TRANSITION_CHECKED_OUT":
        return {
          label: "Resource Checked Out",
          icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
          dotColor: "bg-emerald-500 ring-emerald-500/30",
          badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        };
      case "BOOKING_TRANSITION_RETURNED":
        return {
          label: "Resource Returned & Session Complete",
          icon: <RotateCcw className="w-4 h-4 text-indigo-400" />,
          dotColor: "bg-indigo-500 ring-indigo-500/30",
          badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
        };
      case "condition_report_checkout":
        return {
          label: "Handover Check-Out Inspected",
          icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
          dotColor: "bg-emerald-500 ring-emerald-500/30",
          badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        };
      case "condition_report_return":
        return {
          label: "Return Handover Inspected",
          icon: <RotateCcw className="w-4 h-4 text-indigo-400" />,
          dotColor: "bg-indigo-500 ring-indigo-500/30",
          badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
        };
      case "overdue_flagged":
        return {
          label: "Return Overdue Flagged",
          icon: <AlertTriangle className="w-4 h-4 text-rose-400" />,
          dotColor: "bg-rose-500 ring-rose-500/30",
          badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        };
      case "extension_requested":
        return {
          label: "Extension Requested",
          icon: <Timer className="w-4 h-4 text-purple-400" />,
          dotColor: "bg-purple-500 ring-purple-500/30",
          badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        };
      case "extension_approved":
        return {
          label: "Extension Approved",
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
          dotColor: "bg-emerald-500 ring-emerald-500/30",
          badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        };
      case "extension_rejected":
        return {
          label: "Extension Rejected",
          icon: <XCircle className="w-4 h-4 text-rose-400" />,
          dotColor: "bg-rose-500 ring-rose-500/30",
          badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        };
      case "booking_cancelled":
        return {
          label: "Booking Cancelled",
          icon: <XCircle className="w-4 h-4 text-slate-400" />,
          dotColor: "bg-slate-500 ring-slate-500/30",
          badgeClass: "bg-slate-500/10 text-slate-400 border-slate-500/20",
        };
      case "incident_reported":
        return {
          label: "Incident Reported",
          icon: <ShieldAlert className="w-4 h-4 text-rose-400" />,
          dotColor: "bg-rose-600 ring-rose-600/30",
          badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        };
      default:
        return {
          label: action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          icon: <Info className="w-4 h-4 text-slate-400" />,
          dotColor: "bg-slate-500 ring-slate-500/30",
          badgeClass: "bg-slate-500/10 text-slate-400 border-slate-500/20",
        };
    }
  };

  const gradeColors: Record<ConditionGrade, string> = {
    excellent: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    good: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    fair: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    damaged: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };

  // Find condition reports matching checkout or return
  const checkoutReport = conditionReports.find((r) => r.kind === "checkout");
  const returnReport = conditionReports.find((r) => r.kind === "return");

  return (
    <div className="space-y-4">
      {/* Lightbox / Modal for Photo Viewing */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden p-2"
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
              alt="Inspection photo detail"
              className="max-h-[85vh] w-auto mx-auto object-contain rounded-xl"
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" />
            <span>Audit Trail &amp; Life Cycle Timeline</span>
          </h3>
          <p className="text-xs text-slate-400">
            Immutable chain of custody, decision rationale, and physical inspection history.
          </p>
        </div>
        <span className="text-xs font-mono text-slate-500">
          {entries.length} {entries.length === 1 ? "event" : "events"} recorded
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 text-center">
          <Info className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <p className="text-sm text-slate-300 font-medium">No timeline events found</p>
          <p className="text-xs text-slate-500 mt-1">
            Audit events for this booking will appear here sequentially.
          </p>
        </div>
      ) : (
        <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-800 space-y-6 my-2">
          {entries.map((entry, idx) => {
            const config = getActionConfig(entry.action);
            const isExpanded = Boolean(expandedDetails[entry.id]);
            const hasDetails =
              entry.details &&
              typeof entry.details === "object" &&
              Object.keys(entry.details).length > 0;

            // Associate condition reports
            let linkedConditionReport: TimelineConditionReport | undefined;
            if (entry.action === "condition_report_checkout") {
              linkedConditionReport = checkoutReport;
            } else if (entry.action === "condition_report_return") {
              linkedConditionReport = returnReport;
            }

            return (
              <div key={entry.id || idx} className="relative group">
                {/* Timeline node dot */}
                <div
                  className={`absolute -left-[31px] sm:-left-[39px] top-1.5 w-4 h-4 rounded-full ${config.dotColor} ring-4 transition-transform group-hover:scale-110`}
                />

                <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 transition-all space-y-3">
                  {/* Top row: Action Badge & Timestamp */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${config.badgeClass}`}
                      >
                        {config.icon}
                        <span>{config.label}</span>
                      </span>

                      {/* Actor identity */}
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        {entry.actor_name ? (
                          <>
                            <User className="w-3 h-3 text-slate-500" />
                            <span className="text-slate-300 font-medium">
                              {entry.actor_name}
                            </span>
                          </>
                        ) : (
                          <>
                            <Bot className="w-3 h-3 text-slate-500" />
                            <span className="text-slate-400">System Automation</span>
                          </>
                        )}
                      </span>
                    </div>

                    <time className="text-xs font-mono text-slate-400">
                      {format(new Date(entry.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </time>
                  </div>

                  {/* Reason callout */}
                  {entry.reason && (
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Reason / Rationale
                      </span>
                      <p className="leading-relaxed whitespace-pre-wrap">{entry.reason}</p>
                    </div>
                  )}

                  {/* Attached Condition Report Display (Check-out or Return) */}
                  {linkedConditionReport && (
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-indigo-400" />
                          <span>
                            {linkedConditionReport.kind === "checkout"
                              ? "Baseline Check-Out Inspection"
                              : "Return Verification Inspection"}
                          </span>
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-mono uppercase font-bold border ${
                            gradeColors[linkedConditionReport.grade] || "bg-slate-800 text-white"
                          }`}
                        >
                          Grade: {linkedConditionReport.grade}
                        </span>
                      </div>

                      {/* Checklist Summary */}
                      {linkedConditionReport.checklist && (
                        <div className="space-y-1 pt-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Checklist Items
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {Object.entries(linkedConditionReport.checklist).map(
                              ([label, passed]) => (
                                <div
                                  key={label}
                                  className="flex items-center gap-1.5 text-xs text-slate-300"
                                >
                                  {passed ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  ) : (
                                    <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                  )}
                                  <span className={passed ? "text-slate-300" : "text-rose-300 font-medium"}>
                                    {label}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {/* Inspection Notes */}
                      {linkedConditionReport.notes && (
                        <div className="text-xs text-slate-400 italic">
                          &ldquo;{linkedConditionReport.notes}&rdquo;
                        </div>
                      )}

                      {/* Photo Thumbnails */}
                      {linkedConditionReport.photo_paths &&
                        linkedConditionReport.photo_paths.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                              <ImageIcon className="w-3 h-3 text-slate-400" />
                              <span>
                                Inspection Photos ({linkedConditionReport.photo_paths.length})
                              </span>
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {linkedConditionReport.photo_paths.map((path, pIdx) => {
                                const url = linkedConditionReport?.photoUrls?.[path];
                                return (
                                  <button
                                    key={path || pIdx}
                                    type="button"
                                    onClick={() => url && setSelectedPhoto(url)}
                                    className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 hover:border-indigo-400 hover:ring-2 hover:ring-indigo-500/30 transition-all group/photo cursor-zoom-in"
                                  >
                                    {url ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={url}
                                        alt={`Inspection photo ${pIdx + 1}`}
                                        className="w-full h-full object-cover group-hover/photo:scale-105 transition-transform"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500">
                                        Photo {pIdx + 1}
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                    </div>
                  )}

                  {/* Expandable Technical Details */}
                  {hasDetails && (
                    <div>
                      <button
                        type="button"
                        onClick={() => toggleDetails(entry.id)}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" />
                            <span>Hide Details &amp; Metadata</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            <span>View Full Event Details</span>
                          </>
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto">
                          <pre>{JSON.stringify(entry.details, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

