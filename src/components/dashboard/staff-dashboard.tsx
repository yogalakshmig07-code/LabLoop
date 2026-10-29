import React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ClipboardCheck,
  ArrowLeftRight,
  AlertTriangle,
  Award,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  BarChart3,
  Layers,
  Sparkles,
} from "lucide-react";

export interface HandoverSummaryItem {
  id: string;
  type: "checkout" | "return";
  resourceName: string;
  userName: string;
  userDepartment?: string | null;
  time: string;
  status: string;
  isOverdue?: boolean;
}

export interface ResourceUtilisationItem {
  id: string;
  name: string;
  category: string;
  hoursBooked30Days: number;
  percentageOfMax: number;
  bookingsCount30Days: number;
}

export interface StaffDashboardProps {
  userRole: "owner" | "manager" | "admin";
  userName: string;
  counts: {
    pendingRequests: number;
    waitlisted: number;
    checkedOut: number;
    overdue: number;
    openIncidents: number;
    pendingCredentials: number;
  };
  nextHandovers: HandoverSummaryItem[];
  resourceUtilisation: ResourceUtilisationItem[];
}

export function StaffDashboard({
  userRole,
  userName,
  counts,
  nextHandovers,
  resourceUtilisation,
}: StaffDashboardProps) {
  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Header Banner */}
      <section className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs font-medium text-cyan-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="capitalize">{userRole} Operations Hub</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Custodian Overview: {userName}
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Monitor real-time equipment handovers, verify student safety qualifications, review reservation requests, and track lab utilisation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/review-queue"
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-colors flex items-center gap-2"
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Review Queue ({counts.pendingRequests})</span>
          </Link>
          <Link
            href="/handovers"
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-2"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Handovers</span>
          </Link>
        </div>
      </section>

      {/* 6 Metric Action Cards Linking to Target Pages */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* 1. Pending Requests */}
        <Link
          href="/review-queue"
          className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/90 transition-all group space-y-2"
        >
          <div className="flex items-center justify-between">
            <ClipboardCheck className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-mono text-slate-500 group-hover:text-indigo-400">Queue &rarr;</span>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-white font-mono">{counts.pendingRequests}</div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">Pending Requests</div>
          </div>
        </Link>

        {/* 2. Waitlisted */}
        <Link
          href="/review-queue"
          className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-900/90 transition-all group space-y-2"
        >
          <div className="flex items-center justify-between">
            <Clock className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-mono text-slate-500 group-hover:text-amber-400">Waitlist &rarr;</span>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-white font-mono">{counts.waitlisted}</div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">Waitlisted</div>
          </div>
        </Link>

        {/* 3. Checked Out */}
        <Link
          href="/handovers"
          className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900/90 transition-all group space-y-2"
        >
          <div className="flex items-center justify-between">
            <ArrowLeftRight className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-mono text-slate-500 group-hover:text-cyan-400">Active &rarr;</span>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-white font-mono">{counts.checkedOut}</div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">Checked Out</div>
          </div>
        </Link>

        {/* 4. Overdue */}
        <Link
          href="/handovers"
          className={`p-4 rounded-xl border transition-all group space-y-2 ${
            counts.overdue > 0
              ? "bg-rose-950/20 border-rose-500/40 hover:border-rose-500 hover:bg-rose-950/30"
              : "bg-slate-900 border-slate-800 hover:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <AlertCircle
              className={`w-5 h-5 transition-transform group-hover:scale-110 ${
                counts.overdue > 0 ? "text-rose-400" : "text-slate-400"
              }`}
            />
            <span
              className={`text-[10px] font-mono ${
                counts.overdue > 0 ? "text-rose-400" : "text-slate-500"
              }`}
            >
              Alert &rarr;
            </span>
          </div>
          <div>
            <div
              className={`text-2xl font-extrabold font-mono ${
                counts.overdue > 0 ? "text-rose-400" : "text-white"
              }`}
            >
              {counts.overdue}
            </div>
            <div
              className={`text-xs font-medium mt-0.5 ${
                counts.overdue > 0 ? "text-rose-300" : "text-slate-400"
              }`}
            >
              Overdue Returns
            </div>
          </div>
        </Link>

        {/* 5. Open Incidents */}
        <Link
          href="/incidents"
          className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-900/90 transition-all group space-y-2"
        >
          <div className="flex items-center justify-between">
            <AlertTriangle className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-mono text-slate-500 group-hover:text-amber-400">Issues &rarr;</span>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-white font-mono">{counts.openIncidents}</div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">Open Incidents</div>
          </div>
        </Link>

        {/* 6. Pending Credentials */}
        <Link
          href="/verification"
          className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900/90 transition-all group space-y-2"
        >
          <div className="flex items-center justify-between">
            <Award className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-mono text-slate-500 group-hover:text-emerald-400">Verify &rarr;</span>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-white font-mono">{counts.pendingCredentials}</div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">Pending Certs</div>
          </div>
        </Link>
      </div>

      {/* Main Sections: Next 5 Handovers & Resource Utilisation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Next 5 Handovers */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ArrowLeftRight className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-bold text-white">Next 5 Handovers</h2>
            </div>
            <Link
              href="/handovers"
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <span>Manage all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {nextHandovers.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-950/50 border border-slate-800/80 text-center text-xs text-slate-500">
              No upcoming check-outs or pending returns scheduled for today.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {nextHandovers.map((item) => (
                <div key={item.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-white truncate">
                        {item.resourceName}
                      </span>
                      {item.type === "checkout" ? (
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          Check-Out Due
                        </span>
                      ) : item.isOverdue ? (
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          Overdue Return
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          Return Expected
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-2">
                      <span className="text-slate-300 font-medium">{item.userName}</span>
                      {item.userDepartment && <span className="text-slate-500">({item.userDepartment})</span>}
                      <span className="text-slate-500">•</span>
                      <span className="font-mono text-slate-400">
                        {format(new Date(item.time), "MMM d, h:mm a")}
                      </span>
                    </div>
                  </div>

                  <Link
                    href={
                      item.type === "checkout"
                        ? `/bookings/${item.id}/checkout`
                        : `/bookings/${item.id}/return`
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                      item.type === "checkout"
                        ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                        : item.isOverdue
                        ? "bg-rose-600 hover:bg-rose-500 text-white"
                        : "bg-cyan-600 hover:bg-cyan-500 text-white"
                    }`}
                  >
                    {item.type === "checkout" ? "Check Out" : "Process Return"}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resource Utilisation (Last 30 Days) with Tailwind Visual Progress Bars */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-bold text-white">Resource Utilisation (Last 30 Days)</h2>
            </div>
            <span className="text-xs text-slate-500 font-mono">Tailwind Visuals</span>
          </div>

          {resourceUtilisation.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-950/50 border border-slate-800/80 text-center text-xs text-slate-500">
              No booking utilisation data recorded in the last 30 days.
            </div>
          ) : (
            <div className="space-y-4">
              {resourceUtilisation.map((res) => (
                <div key={res.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200 truncate">{res.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold text-indigo-300">
                        {res.hoursBooked30Days}h
                      </span>
                      <span className="text-slate-500 font-mono">
                        ({res.bookingsCount30Days} {res.bookingsCount30Days === 1 ? "booking" : "bookings"})
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Tailwind Progress Bar */}
                  <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden flex">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(5, res.percentageOfMax))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

