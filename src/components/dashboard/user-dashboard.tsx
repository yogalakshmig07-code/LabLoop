import React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Calendar,
  Clock,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  Compass,
  Award,
  Bell,
  CheckCircle2,
  Hourglass,
  Layers,
} from "lucide-react";
import { PriorityTier, BookingStatus, CredentialStatus } from "@/types/db";

export interface UserDashboardProps {
  user: {
    id: string;
    name: string;
    email: string;
    department?: string | null;
    strikes: number;
  };
  upcomingBookings: Array<{
    id: string;
    status: BookingStatus;
    start_at: string;
    end_at: string;
    resource: {
      id: string;
      name: string;
      category: string;
      location?: string | null;
    };
  }>;
  pendingRequests: Array<{
    id: string;
    status: BookingStatus;
    start_at: string;
    end_at: string;
    purpose: string;
    priority_tier: PriorityTier;
    created_at: string;
    resource: {
      id: string;
      name: string;
      category: string;
    };
  }>;
  waitlistedBookings: Array<{
    id: string;
    start_at: string;
    end_at: string;
    priority_tier: PriorityTier;
    waitlist_rank: number;
    resource: {
      id: string;
      name: string;
      category: string;
    };
  }>;
  recentNotifications: Array<{
    id: string;
    title: string;
    body: string;
    is_read: boolean;
    created_at: string;
    link?: string | null;
  }>;
  credentials: Array<{
    id: string;
    type: string;
    status: CredentialStatus;
    expires_at?: string | null;
    reviewer_notes?: string | null;
  }>;
}

export function UserDashboard({
  user,
  upcomingBookings,
  pendingRequests,
  waitlistedBookings,
  recentNotifications,
  credentials,
}: UserDashboardProps) {
  const strikesCount = user.strikes || 0;

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case "approved":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "checked_out":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      case "waitlisted":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "pending_review":
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
      case "returned":
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  const getCredentialBadge = (status: CredentialStatus) => {
    switch (status) {
      case "verified":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "pending":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "expired":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Welcome Banner & Quick Action */}
      <section className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-medium text-indigo-400">
            <Layers className="w-3.5 h-3.5" />
            <span>Student &amp; Researcher Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Welcome back, {user.name}
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Manage your equipment reservations, monitor safety credentials, and view real-time waitlist standings.
          </p>
        </div>

        <Link
          href="/resources"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
        >
          <Compass className="w-4 h-4" />
          <span>Browse Resources</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </Link>
      </section>

      {/* Reliability & Strikes Notice Banner */}
      <section className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              strikesCount === 0
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : strikesCount < 3
                ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
            }`}
          >
            {strikesCount === 0 ? (
              <ShieldCheck className="w-5 h-5" />
            ) : (
              <ShieldAlert className="w-5 h-5" />
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-white">Reliability Standing</span>
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${
                  strikesCount === 0
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : strikesCount < 3
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                }`}
              >
                {strikesCount} {strikesCount === 1 ? "Active Strike" : "Active Strikes"}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
              Strikes lower your waitlist priority; they never block you automatically. A person reviews every penalty.
            </p>
          </div>
        </div>

        <Link
          href="/profile"
          className="text-xs font-medium text-indigo-400 hover:text-indigo-300 underline underline-offset-4 shrink-0"
        >
          View Reliability Details
        </Link>
      </section>

      {/* Main Grid: Bookings & Waitlist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Upcoming & Pending Bookings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Confirmed Bookings */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">Upcoming Confirmed Bookings</h2>
              </div>
              <Link
                href="/bookings"
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {upcomingBookings.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-950/50 border border-slate-800/80 text-center space-y-2">
                <p className="text-xs text-slate-400">No active or upcoming reservations scheduled.</p>
                <Link
                  href="/resources"
                  className="inline-block text-xs text-indigo-400 hover:underline font-medium"
                >
                  Find equipment or reserve a lab slot &rarr;
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {upcomingBookings.map((b) => (
                  <div key={b.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white truncate">
                          {b.resource.name}
                        </span>
                        <span
                          className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${getStatusBadge(
                            b.status
                          )}`}
                        >
                          {b.status.replace("_", " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          {format(new Date(b.start_at), "EEE, MMM d • h:mm a")} -{" "}
                          {format(new Date(b.end_at), "h:mm a")}
                        </span>
                        {b.resource.location && (
                          <span className="text-slate-500 truncate">• {b.resource.location}</span>
                        )}
                      </div>
                    </div>

                    <Link
                      href={`/bookings/${b.id}`}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors shrink-0"
                    >
                      View Details
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Approval Requests */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Hourglass className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-bold text-white">Pending Requests Awaiting Review</h2>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {pendingRequests.length} pending
              </span>
            </div>

            {pendingRequests.length === 0 ? (
              <div className="p-5 rounded-xl bg-slate-950/50 border border-slate-800/80 text-center text-xs text-slate-500">
                You have no reservation requests waiting for custodian review.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {pendingRequests.map((req) => (
                  <div key={req.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white truncate">
                          {req.resource.name}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {req.priority_tier}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-1 italic">
                        &ldquo;{req.purpose}&rdquo;
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Requested for {format(new Date(req.start_at), "MMM d, h:mm a")} -{" "}
                        {format(new Date(req.end_at), "h:mm a")}
                      </p>
                    </div>

                    <Link
                      href={`/bookings/${req.id}`}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors shrink-0"
                    >
                      Check Status
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Waitlist Positions */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-bold text-white">Waitlist Positions</h2>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {waitlistedBookings.length} queued
              </span>
            </div>

            {waitlistedBookings.length === 0 ? (
              <div className="p-5 rounded-xl bg-slate-950/50 border border-slate-800/80 text-center text-xs text-slate-500">
                You are not on any resource waiting lists currently.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {waitlistedBookings.map((wb) => (
                  <div key={wb.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white truncate">
                          {wb.resource.name}
                        </span>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Rank #{wb.waitlist_rank || 1}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                          {wb.priority_tier}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Slot: {format(new Date(wb.start_at), "EEE, MMM d • h:mm a")} -{" "}
                        {format(new Date(wb.end_at), "h:mm a")}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Ranked automatically by tier points, recent usage decay, and reliability standing.
                      </p>
                    </div>

                    <Link
                      href={`/bookings/${wb.id}`}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors shrink-0"
                    >
                      Track Slot
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 col): Safety Credentials & Notifications */}
        <div className="space-y-6">
          {/* Credentials Card */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-bold text-white">Safety Credentials</h2>
              </div>
              <Link
                href="/profile"
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <span>Upload</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {credentials.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 text-center space-y-2">
                <p className="text-xs text-slate-400">No safety certifications uploaded yet.</p>
                <Link
                  href="/profile"
                  className="inline-block text-xs text-indigo-400 hover:underline font-medium"
                >
                  Upload your training certificate &rarr;
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {credentials.map((cred) => (
                  <div
                    key={cred.id}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-200 truncate capitalize">
                        {cred.type.replace(/_/g, " ")}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {cred.expires_at
                          ? `Expires ${format(new Date(cred.expires_at), "MMM d, yyyy")}`
                          : "No expiration"}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border shrink-0 ${getCredentialBadge(
                        cred.status
                      )}`}
                    >
                      {cred.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Notifications Summary */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">Recent Alerts</h2>
              </div>
              <Link
                href="/notifications"
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <span>All Alerts</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recentNotifications.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 text-center text-xs text-slate-500">
                You have no recent alerts or reminders.
              </div>
            ) : (
              <div className="space-y-3">
                {recentNotifications.slice(0, 4).map((notif) => (
                  <div
                    key={notif.id}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-200 truncate">
                        {notif.title}
                      </span>
                      {!notif.is_read && (
                        <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {notif.body}
                    </p>
                    <span className="text-[10px] text-slate-500 block font-mono">
                      {format(new Date(notif.created_at), "MMM d, h:mm a")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

