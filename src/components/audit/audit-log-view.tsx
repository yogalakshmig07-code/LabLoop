"use client";

import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import {
  ScrollText,
  Search,
  Filter,
  Download,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Calendar,
  User,
  Shield,
  Layers,
  Info,
} from "lucide-react";

export interface AuditLogItem {
  id: string;
  created_at: string;
  actor_id?: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  booking_id?: string | null;
  resource_id?: string | null;
  reason?: string | null;
  details?: any;
}

interface AuditLogViewProps {
  entries: AuditLogItem[];
  title?: string;
  subtitle?: string;
  isScoped?: boolean;
}

const ACTION_LABELS: Record<string, { label: string; badge: string }> = {
  booking_created: { label: "Reservation Requested", badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  booking_approved: { label: "Reservation Approved", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  booking_rejected: { label: "Reservation Declined", badge: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  booking_cancelled: { label: "Reservation Cancelled", badge: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  checkout_completed: { label: "Equipment Checked Out", badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  return_completed: { label: "Equipment Returned & Inspected", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  incident_reported: { label: "Incident Reported", badge: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  incident_under_review: { label: "Incident Under Review", badge: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  incident_resolved: { label: "Incident Resolved", badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  dispute_submitted: { label: "Dispute Lodged", badge: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  dispute_resolved: { label: "Dispute Adjudicated", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  credential_submitted: { label: "Credential Uploaded", badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  credential_verified: { label: "Credential Verified", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  credential_rejected: { label: "Credential Rejected", badge: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  user_role_changed: { label: "User Role Updated", badge: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  owner_verified: { label: "Owner Faculty Verified", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  fairness_settings_updated: { label: "Fairness Quotas Updated", badge: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
};

export function AuditLogView({
  entries,
  title = "Immutable Audit Log",
  subtitle = "Cryptographically recorded append-only event stream tracking all reservation transitions, handovers, condition ratings, and incident resolutions.",
  isScoped = false,
}: AuditLogViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAction, setSelectedAction] = useState("all");
  const [selectedEntity, setSelectedEntity] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Distinct filter options
  const distinctActions = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => set.add(e.action));
    return Array.from(set).sort();
  }, [entries]);

  const distinctEntities = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => set.add(e.entity_type));
    return Array.from(set).sort();
  }, [entries]);

  // Filtering
  const filteredEntries = useMemo(() => {
    const now = Date.now();

    return entries.filter((entry) => {
      // Text search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesAction = entry.action.toLowerCase().includes(term);
        const matchesReason = (entry.reason || "").toLowerCase().includes(term);
        const matchesActor = (entry.actor_name || "").toLowerCase().includes(term) || (entry.actor_email || "").toLowerCase().includes(term);
        const matchesEntity = entry.entity_type.toLowerCase().includes(term) || (entry.entity_id || "").toLowerCase().includes(term);
        if (!matchesAction && !matchesReason && !matchesActor && !matchesEntity) {
          return false;
        }
      }

      // Action filter
      if (selectedAction !== "all" && entry.action !== selectedAction) {
        return false;
      }

      // Entity filter
      if (selectedEntity !== "all" && entry.entity_type !== selectedEntity) {
        return false;
      }

      // Date range filter
      if (dateRange !== "all") {
        const itemTime = new Date(entry.created_at).getTime();
        if (dateRange === "today") {
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);
          if (itemTime < startOfToday.getTime()) return false;
        } else if (dateRange === "7days") {
          if (now - itemTime > 7 * 24 * 60 * 60 * 1000) return false;
        } else if (dateRange === "30days") {
          if (now - itemTime > 30 * 24 * 60 * 60 * 1000) return false;
        }
      }

      return true;
    });
  }, [entries, searchTerm, selectedAction, selectedEntity, dateRange]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEntries.slice(start, start + pageSize);
  }, [filteredEntries, currentPage, pageSize]);

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      "Timestamp",
      "Action",
      "Entity Type",
      "Entity ID",
      "Actor Name",
      "Actor ID",
      "Booking ID",
      "Resource ID",
      "Reason",
      "Details",
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = typeof val === "object" ? JSON.stringify(val) : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = filteredEntries.map((e) => [
      escapeCsv(e.created_at),
      escapeCsv(e.action),
      escapeCsv(e.entity_type),
      escapeCsv(e.entity_id),
      escapeCsv(e.actor_name),
      escapeCsv(e.actor_id),
      escapeCsv(e.booking_id),
      escapeCsv(e.resource_id),
      escapeCsv(e.reason),
      escapeCsv(e.details),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `labloop-audit-log-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ScrollText className="w-6 h-6 text-indigo-400" />
            <span>{title}</span>
            {isScoped && (
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Scoped to Managed Resources
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">{subtitle}</p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors shrink-0 shadow-sm"
        >
          <Download className="w-4 h-4 text-indigo-400" />
          <span>Export CSV ({filteredEntries.length})</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Term */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search actions, reasons, actors..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Action Filter */}
          <div>
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Action Types ({distinctActions.length})</option>
              {distinctActions.map((act) => (
                <option key={act} value={act}>
                  {ACTION_LABELS[act]?.label || act}
                </option>
              ))}
            </select>
          </div>

          {/* Entity Filter */}
          <div>
            <select
              value={selectedEntity}
              onChange={(e) => {
                setSelectedEntity(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 capitalize"
            >
              <option value="all">All Entity Types ({distinctEntities.length})</option>
              {distinctEntities.map((ent) => (
                <option key={ent} value={ent}>
                  {ent}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today Only</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
          </div>
        </div>

        {/* Filter Summary */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <span>
            Showing <span className="font-mono text-white font-semibold">{filteredEntries.length}</span> recorded
            events
          </span>
          {(searchTerm || selectedAction !== "all" || selectedEntity !== "all" || dateRange !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setSelectedAction("all");
                setSelectedEntity("all");
                setDateRange("all");
                setCurrentPage(1);
              }}
              className="text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
        {paginatedEntries.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <ScrollText className="w-8 h-8 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-white">No audit records match your filters</h3>
            <p className="text-xs text-slate-400">Try widening your date range or clearing the search terms.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="py-3.5 px-4 w-10"></th>
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Entity</th>
                  <th className="py-3.5 px-4">Actor</th>
                  <th className="py-3.5 px-4">Reason / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {paginatedEntries.map((entry) => {
                  const isExpanded = expandedRows.has(entry.id);
                  const actionMeta = ACTION_LABELS[entry.action] || {
                    label: entry.action.replace(/_/g, " "),
                    badge: "bg-slate-500/10 text-slate-400 border-slate-500/20",
                  };

                  return (
                    <React.Fragment key={entry.id}>
                      <tr
                        onClick={() => toggleRow(entry.id)}
                        className={`cursor-pointer transition-colors ${
                          isExpanded ? "bg-slate-800/50" : "hover:bg-slate-800/20"
                        }`}
                      >
                        <td className="py-3 px-4 text-slate-500">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-indigo-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-600" />
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap font-mono text-[11px]">
                          {format(new Date(entry.created_at), "yyyy-MM-dd HH:mm:ss")}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-block text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${actionMeta.badge}`}
                          >
                            {actionMeta.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono text-slate-300 capitalize">{entry.entity_type}</span>
                          {entry.entity_id && (
                            <span className="text-[10px] font-mono text-slate-500 block">
                              {entry.entity_id.slice(0, 8)}...
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-white">{entry.actor_name || "System"}</div>
                          {entry.actor_email && (
                            <div className="text-[10px] font-mono text-slate-500">{entry.actor_email}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-300 max-w-xs truncate">
                          {entry.reason ? (
                            <span>{entry.reason}</span>
                          ) : (
                            <span className="text-slate-600 italic">No reason logged</span>
                          )}
                        </td>
                      </tr>

                      {/* Expandable JSON Details View */}
                      {isExpanded && (
                        <tr className="bg-slate-950/80 border-b border-slate-800">
                          <td colSpan={6} className="p-4 pl-12 space-y-3">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                              <Info className="w-4 h-4 text-indigo-400" />
                              <span>Immutable Record Details (Audit ID: {entry.id})</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                                <span className="text-slate-500 text-[10px] block">Actor ID</span>
                                <span className="text-slate-200">{entry.actor_id || "System / Automated"}</span>
                              </div>
                              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                                <span className="text-slate-500 text-[10px] block">Booking Ref</span>
                                <span className="text-slate-200">{entry.booking_id || "None"}</span>
                              </div>
                              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                                <span className="text-slate-500 text-[10px] block">Resource Ref</span>
                                <span className="text-slate-200">{entry.resource_id || "None"}</span>
                              </div>
                            </div>

                            <div>
                              <span className="text-xs font-semibold text-slate-400 block mb-1">
                                Metadata Payload:
                              </span>
                              <pre className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-indigo-300 overflow-x-auto max-h-60 leading-relaxed">
                                {JSON.stringify(entry.details || {}, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Page <span className="text-white font-mono">{currentPage}</span> of{" "}
              <span className="text-white font-mono">{totalPages}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 font-medium transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 font-medium transition-colors flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

