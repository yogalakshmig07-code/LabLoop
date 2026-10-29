"use client";

import React, { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  CheckCircle2,
  HelpCircle,
  Filter,
  ArrowRight,
  User,
  Building,
  Flame,
  Scale,
  Sparkles,
} from "lucide-react";
import { IncidentType, IncidentStatus } from "@/types/db";

export interface IncidentListItem {
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
  strike_applied: boolean;
  dispute_note: string | null;
  created_at: string;
  resource?: {
    id: string;
    name: string;
    category: string;
  } | null;
  reporter?: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
  booking?: {
    id: string;
    start_at: string;
    end_at: string;
    borrower?: {
      id: string;
      full_name: string | null;
      email: string | null;
    } | null;
  } | null;
}

interface IncidentsViewProps {
  incidents: IncidentListItem[];
  viewerRole: string;
}

export function IncidentsView({ incidents, viewerRole }: IncidentsViewProps) {
  const [filter, setFilter] = useState<string>("all");

  const filtered = incidents.filter((inc) => {
    if (filter === "all") return true;
    return inc.status === filter;
  });

  const counts = {
    all: incidents.length,
    open: incidents.filter((i) => i.status === "open").length,
    under_review: incidents.filter((i) => i.status === "under_review").length,
    disputed: incidents.filter((i) => i.status === "disputed").length,
    resolved: incidents.filter((i) => i.status === "resolved").length,
  };

  const severityBadge = (sev: "low" | "medium" | "high") => {
    switch (sev) {
      case "high":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">High Severity</span>;
      case "medium":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">Medium Severity</span>;
      case "low":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">Low Severity</span>;
    }
  };

  const statusBadge = (status: IncidentStatus) => {
    switch (status) {
      case "open":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            Open
          </span>
        );
      case "under_review":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Clock className="w-3 h-3" />
            Under Review
          </span>
        );
      case "disputed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
            <Scale className="w-3.5 h-3.5" />
            Disputed
          </span>
        );
      case "resolved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Resolved
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "all", label: "All Incidents", count: counts.all },
            { id: "open", label: "Open", count: counts.open, alert: counts.open > 0 },
            { id: "under_review", label: "Under Review", count: counts.under_review },
            { id: "disputed", label: "Disputed", count: counts.disputed, alert: counts.disputed > 0 },
            { id: "resolved", label: "Resolved", count: counts.resolved },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                filter === tab.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  filter === tab.id
                    ? "bg-indigo-700 text-white"
                    : tab.alert
                    ? "bg-rose-500/20 text-rose-300 font-bold"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-500">
          Showing {filtered.length} of {incidents.length} incidents
        </span>
      </div>

      {/* Incidents Grid */}
      {filtered.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
          <ShieldAlert className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-300">No incident reports found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {filter === "all"
              ? "All managed campus facilities and equipment are operating smoothly without open incident reports."
              : `There are currently no incidents in the '${filter.replace("_", " ")}' queue.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((inc) => {
            const isDisputed = inc.status === "disputed";
            const reporterName = inc.reporter?.full_name || inc.reporter?.email || "User";
            const borrowerName = inc.booking?.borrower?.full_name || inc.booking?.borrower?.email || "Student";

            return (
              <Link
                key={inc.id}
                href={`/incidents/${inc.id}`}
                className={`block p-5 rounded-2xl border transition-all group ${
                  isDisputed
                    ? "bg-amber-950/20 border-amber-500/40 hover:border-amber-400 shadow-lg shadow-amber-950/20 ring-1 ring-amber-500/20"
                    : "bg-slate-900/90 border-slate-800 hover:border-slate-700 shadow-sm"
                }`}
              >
                <div className="space-y-3">
                  {/* Highlight banner for disputed incidents */}
                  {isDisputed && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs">
                      <Scale className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="font-semibold">
                        Borrower disputed this incident resolution:
                      </span>
                      <span className="italic truncate">&ldquo;{inc.dispute_note}&rdquo;</span>
                    </div>
                  )}

                  {/* Header Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700 font-semibold">
                        {inc.incident_type}
                      </span>
                      {severityBadge(inc.severity)}
                      {inc.strike_applied && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          <Flame className="w-3 h-3" />
                          Strike Applied
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {statusBadge(inc.status)}
                      <time className="text-xs font-mono text-slate-500">
                        {format(new Date(inc.created_at), "MMM d, yyyy")}
                      </time>
                    </div>
                  </div>

                  {/* Title / Resource / Parties */}
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors flex items-center justify-between">
                      <span>{inc.resource?.name || "Equipment"}</span>
                      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-transform group-hover:translate-x-1" />
                    </h4>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        Reported by: <span className="text-slate-300">{reporterName}</span>
                      </span>
                      {inc.booking_id && (
                        <span>
                          Borrower: <span className="text-slate-300">{borrowerName}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description snippet */}
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                    {inc.description}
                  </p>

                  {/* AI Summary Advisory preview */}
                  {inc.ai_summary && (
                    <div className="p-2.5 rounded-xl bg-indigo-950/20 border border-indigo-500/20 flex items-start gap-2 text-[11px] text-slate-400">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                      <p className="line-clamp-2">
                        <span className="text-indigo-300 font-semibold">AI Summary: </span>
                        {inc.ai_summary}
                      </p>
                    </div>
                  )}

                  {/* Resolution note preview if resolved */}
                  {inc.resolution && inc.status === "resolved" && (
                    <div className="text-[11px] text-emerald-400/90 pt-1 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">Resolution: {inc.resolution}</span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

