import React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ShieldAlert,
  Users,
  Layers,
  CalendarCheck,
  AlertTriangle,
  Scale,
  UserCheck,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  ExternalLink,
  Sparkles,
} from "lucide-react";

export interface TopFairnessUser {
  id: string;
  name: string;
  email: string;
  department?: string | null;
  hoursBooked30Days: number;
  ratioToAverage: number;
  riskLevel: "low" | "moderate" | "high";
}

export interface OpenDisputeItem {
  id: string;
  bookingId: string;
  resourceName: string;
  userName: string;
  type: string;
  disputeReason: string;
  createdAt: string;
}

export interface UnverifiedOwnerItem {
  id: string;
  name: string;
  email: string;
  department?: string | null;
  createdAt: string;
}

export interface AdminDashboardProps {
  adminName: string;
  totals: {
    totalUsers: number;
    activeResources: number;
    totalBookings: number;
    openIncidents: number;
  };
  fairnessSnapshot: {
    platformAverageHours: number;
    topUsers: TopFairnessUser[];
  };
  openDisputes: OpenDisputeItem[];
  unverifiedOwners: UnverifiedOwnerItem[];
}

export function AdminDashboard({
  adminName,
  totals,
  fairnessSnapshot,
  openDisputes,
  unverifiedOwners,
}: AdminDashboardProps) {
  const getRiskBadge = (level: "low" | "moderate" | "high") => {
    switch (level) {
      case "high":
        return "bg-rose-500/20 text-rose-300 border-rose-500/30";
      case "moderate":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case "low":
      default:
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Header Banner */}
      <section className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-slate-900 via-rose-950/30 to-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-xs font-medium text-rose-400">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Central Campus Administrator</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Executive Operations: {adminName}
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Monitor campus-wide resource allocation, identify monopolisation risks, adjudicate contested damage disputes, and manage faculty custodian accounts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/users"
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-colors flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            <span>User Directory</span>
          </Link>
          <Link
            href="/admin/settings"
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-2"
          >
            <Scale className="w-4 h-4" />
            <span>Fairness Settings</span>
          </Link>
        </div>
      </section>

      {/* Platform Totals Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Campus Users</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{totals.totalUsers}</div>
          <p className="text-[11px] text-slate-500">Students, faculty owners &amp; managers</p>
        </div>

        {/* Active Resources */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Resources</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{totals.activeResources}</div>
          <p className="text-[11px] text-slate-500">Benches, labs, 3D printers, cameras</p>
        </div>

        {/* Total Bookings */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Reservations Created</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{totals.totalBookings}</div>
          <p className="text-[11px] text-slate-500">GIST non-overlapping bookings logged</p>
        </div>

        {/* Open Incidents */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Open Incidents</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{totals.openIncidents}</div>
          <p className="text-[11px] text-slate-500">Damage reports &amp; delays logged</p>
        </div>
      </div>

      {/* Fairness Snapshot (Monopolisation Risk) */}
      <section className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <Scale className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-bold text-white">Fairness Snapshot: Monopolisation Risk</h2>
              <p className="text-xs text-slate-400">
                Top 5 users by hours booked in the last 30 days compared against the platform average (
                <span className="font-mono text-indigo-300 font-semibold">
                  {fairnessSnapshot.platformAverageHours}h avg
                </span>
                ).
              </p>
            </div>
          </div>
          <Link
            href="/admin/settings"
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 shrink-0"
          >
            <span>Adjust caps</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {fairnessSnapshot.topUsers.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-950/50 border border-slate-800/80 text-center text-xs text-slate-500">
            No booking hours recorded in the past 30 days.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-3 font-semibold">User</th>
                  <th className="pb-3 font-semibold">Department</th>
                  <th className="pb-3 font-semibold">Hours (30d)</th>
                  <th className="pb-3 font-semibold">vs Campus Avg</th>
                  <th className="pb-3 font-semibold text-right">Risk Assessment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {fairnessSnapshot.topUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3">
                      <div className="font-semibold text-white">{u.name}</div>
                      <div className="text-[11px] font-mono text-slate-500">{u.email}</div>
                    </td>
                    <td className="py-3 text-slate-400">{u.department || "General"}</td>
                    <td className="py-3 font-mono font-bold text-white">{u.hoursBooked30Days}h</td>
                    <td className="py-3 font-mono text-indigo-300">
                      {u.ratioToAverage > 1 ? `+${u.ratioToAverage}x avg` : `${u.ratioToAverage}x avg`}
                    </td>
                    <td className="py-3 text-right">
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${getRiskBadge(
                          u.riskLevel
                        )}`}
                      >
                        {u.riskLevel === "high"
                          ? "Elevated Monopolisation Risk"
                          : u.riskLevel === "moderate"
                          ? "Moderate Usage"
                          : "Balanced Quota"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Two Column Section: Open Disputes & Unverified Owners */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Open Disputes */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <h2 className="text-base font-bold text-white">Contested Incident Disputes</h2>
            </div>
            <Link
              href="/incidents"
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <span>All Incidents</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {openDisputes.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-950/50 border border-slate-800/80 text-center space-y-1">
              <div className="flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-400">No open disputes requiring central admin review.</p>
              <p className="text-[11px] text-slate-500">All custodian condition incident rulings have been accepted.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {openDisputes.map((dispute) => (
                <div key={dispute.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-white truncate">
                        {dispute.resourceName}
                      </span>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        Contested
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 italic line-clamp-1">
                      &ldquo;{dispute.disputeReason}&rdquo;
                    </p>
                    <div className="text-[11px] text-slate-500">
                      Disputed by <span className="text-slate-400">{dispute.userName}</span> •{" "}
                      {format(new Date(dispute.createdAt), "MMM d, h:mm a")}
                    </div>
                  </div>

                  <Link
                    href={`/incidents/${dispute.id}`}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors shrink-0"
                  >
                    Adjudicate
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unverified Owners */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <UserCheck className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-bold text-white">Unverified Faculty Owners</h2>
            </div>
            <Link
              href="/admin/users"
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <span>Manage users</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {unverifiedOwners.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-950/50 border border-slate-800/80 text-center space-y-1">
              <div className="flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-400">All faculty resource owners are verified.</p>
              <p className="text-[11px] text-slate-500">No unconfirmed faculty accounts pending review.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {unverifiedOwners.map((owner) => (
                <div key={owner.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-white truncate">{owner.name}</span>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Unverified
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono truncate">{owner.email}</div>
                    <div className="text-[11px] text-slate-500">
                      Dept: {owner.department || "Unassigned"} • Registered{" "}
                      {format(new Date(owner.createdAt), "MMM d, yyyy")}
                    </div>
                  </div>

                  <Link
                    href="/admin/users"
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors shrink-0"
                  >
                    Verify Faculty
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

