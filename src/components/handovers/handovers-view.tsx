"use client";

import React, { useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Clock,
  MapPin,
  User,
  AlertTriangle,
  CheckCircle2,
  Timer,
  Play,
  RotateCcw,
  RefreshCw,
  Loader2,
  Building,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { format, formatDistanceStrict, isAfter, isBefore } from "date-fns";
import { runOverdueCheckAction } from "@/actions/handovers";
import { useToast } from "@/components/ui/toast";
import { ResourceCategory } from "@/types/db";

export interface HandoverBookingItem {
  id: string;
  status: string;
  start_at: string;
  end_at: string;
  checked_out_at?: string | null;
  purpose: string | null;
  priority_tier: string;
  resource: {
    id: string;
    name: string;
    category: ResourceCategory;
    location: string | null;
  };
  user: {
    id: string;
    full_name: string | null;
    email: string | null;
    department: string | null;
    strikes: number;
  };
}

interface HandoversViewProps {
  approvedBookings: HandoverBookingItem[];
  checkedOutBookings: HandoverBookingItem[];
}

export function HandoversView({
  approvedBookings,
  checkedOutBookings,
}: HandoversViewProps) {
  const [isPending, startTransition] = useTransition();
  const { success, error: toastError } = useToast();
  const now = new Date();

  const handleRunOverdueCheck = () => {
    startTransition(async () => {
      const res = await runOverdueCheckAction();
      if (res.ok) {
        success(
          `Overdue monitor completed: ${res.data.overdueFlaggedCount} overdue sessions flagged, ${res.data.remindersSentCount} session reminders delivered.`
        );
      } else {
        toastError(res.error || "Failed to run overdue monitor.");
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Action Header Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Facility Handover Desk</h2>
            <p className="text-xs text-slate-400">
              Manage physical gear inspections, verify equipment checklists, and flag overdue sessions
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={isPending}
          onClick={handleRunOverdueCheck}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold transition-all disabled:opacity-50 self-start sm:self-auto"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
          )}
          <span>Run Overdue &amp; Reminder Check</span>
        </button>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 1. CURRENTLY CHECKED OUT (with overdue highlighted in red) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Timer className="w-4 h-4 text-emerald-400" />
            <span>Currently Checked Out ({checkedOutBookings.length})</span>
          </h2>
          <span className="text-xs text-slate-500">
            Active equipment in the field
          </span>
        </div>

        {checkedOutBookings.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-500">
            No equipment is currently checked out.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {checkedOutBookings.map((b) => {
              const endAt = new Date(b.end_at);
              const isOverdue = now > endAt;
              const overdueDuration = isOverdue ? formatDistanceStrict(now, endAt) : null;

              return (
                <div
                  key={b.id}
                  className={`p-5 rounded-2xl border transition-all shadow-sm space-y-3.5 ${
                    isOverdue
                      ? "bg-red-950/20 border-red-500/40 hover:border-red-500/60"
                      : "bg-slate-900 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-indigo-300">
                          {b.resource.category}
                        </span>
                        <h3 className="text-base font-bold text-white">{b.resource.name}</h3>
                      </div>
                      {b.resource.location && (
                        <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          <span>{b.resource.location}</span>
                        </p>
                      )}
                    </div>

                    {/* Overdue Badge */}
                    {isOverdue ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/30 shrink-0">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                        <span>Overdue by {overdueDuration}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 shrink-0">
                        <Timer className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                        <span>In Session</span>
                      </span>
                    )}
                  </div>

                  {/* Occupant Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-indigo-300">
                        {(b.user.full_name || b.user.email || "U").substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-semibold text-white block truncate">
                          {b.user.full_name || "Student"}
                        </span>
                        <span className="text-slate-400 text-[11px]">{b.user.department || b.user.email}</span>
                      </div>
                    </div>

                    <div className="space-y-0.5 sm:text-right">
                      <span className="text-[11px] text-slate-500 block">Scheduled Return:</span>
                      <span className={`font-mono font-semibold ${isOverdue ? "text-red-400 font-bold" : "text-slate-200"}`}>
                        {format(endAt, "h:mm a (MMM d)")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                    <Link
                      href={`/bookings/${b.id}`}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      <span>Booking Details</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>

                    <Link
                      href={`/bookings/${b.id}/return`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Process Return</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 2. TODAY & UPCOMING APPROVED (Ready or scheduled for Check-out) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-400" />
            <span>Today &amp; Upcoming Approved ({approvedBookings.length})</span>
          </h2>
          <span className="text-xs text-slate-500">
            Check-out opens 30 minutes before start time
          </span>
        </div>

        {approvedBookings.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-500">
            No upcoming approved bookings scheduled for check-out.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {approvedBookings.map((b) => {
              const startAt = new Date(b.start_at);
              const endAt = new Date(b.end_at);
              const earliestCheckout = new Date(startAt.getTime() - 30 * 60 * 1000);

              const canCheckout = now >= earliestCheckout && now <= endAt;
              const isTooEarly = now < earliestCheckout;
              const isExpired = now > endAt;

              return (
                <div
                  key={b.id}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-sm space-y-3.5"
                >
                  <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-indigo-300">
                          {b.resource.category}
                        </span>
                        <h3 className="text-base font-bold text-white">{b.resource.name}</h3>
                      </div>
                      {b.resource.location && (
                        <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          <span>{b.resource.location}</span>
                        </p>
                      )}
                    </div>

                    {/* Grace Window Status */}
                    {canCheckout ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Ready for Check-out</span>
                      </span>
                    ) : isTooEarly ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Opens {format(earliestCheckout, "h:mm a")}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 shrink-0">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Expired Slot</span>
                      </span>
                    )}
                  </div>

                  {/* Booker Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-indigo-300">
                        {(b.user.full_name || b.user.email || "U").substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-semibold text-white block truncate">
                          {b.user.full_name || "Student"}
                        </span>
                        <span className="text-slate-400 text-[11px]">{b.user.department || b.user.email}</span>
                      </div>
                    </div>

                    <div className="space-y-0.5 sm:text-right">
                      <span className="text-[11px] text-slate-500 block">Session Time:</span>
                      <span className="font-mono text-slate-200">
                        {format(startAt, "h:mm a")} - {format(endAt, "h:mm a")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                    <Link
                      href={`/bookings/${b.id}`}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      <span>Booking Details</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>

                    {canCheckout ? (
                      <Link
                        href={`/bookings/${b.id}/checkout`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Start Check-out</span>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled
                        title={isTooEarly ? "Check-out opens 30 minutes before session start" : "Session time expired"}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-slate-500 text-xs font-semibold cursor-not-allowed opacity-60"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Start Check-out</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

