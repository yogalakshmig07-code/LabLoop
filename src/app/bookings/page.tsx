import { requireUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import Link from "next/link";
import {
  CalendarClock,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Timer,
  ChevronRight,
  ExternalLink,
  Plus,
} from "lucide-react";
import { format, formatDistanceStrict } from "date-fns";
import { BookingStatus, PriorityTier } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const session = await requireUser();
  const admin = createAdminClient();

  const { data: bookingsData } = (await admin
    .from("bookings")
    .select(`
      id,
      status,
      priority_tier,
      purpose,
      start_at,
      end_at,
      decision_reason,
      system_check,
      waitlist_rank,
      created_at,
      checked_out_at,
      returned_at,
      ext_requested_end_at,
      ext_status,
      resource:resources(id, name, category, location, image_path)
    `)
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })) as { data: any[] | null };

  const allBookings = bookingsData || [];

  const activeBookings = allBookings.filter((b) => b.status === "checked_out");
  const upcomingBookings = allBookings.filter((b) => b.status === "approved");
  const pendingBookings = allBookings.filter(
    (b) => b.status === "pending_review" || b.status === "waitlisted"
  );
  const pastBookings = allBookings.filter(
    (b) => b.status === "returned" || b.status === "rejected" || b.status === "cancelled"
  );

  const getStatusBadge = (status: BookingStatus, waitlistRank?: number | null) => {
    switch (status) {
      case "checked_out":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <Timer className="w-3.5 h-3.5 animate-pulse" />
            <span>Active Session</span>
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Confirmed</span>
          </span>
        );
      case "waitlisted":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            <span>Waitlisted {waitlistRank ? `#${waitlistRank}` : ""}</span>
          </span>
        );
      case "pending_review":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            <Clock className="w-3.5 h-3.5" />
            <span>Under Review</span>
          </span>
        );
      case "returned":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Returned</span>
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            <span>Declined</span>
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-500 border border-slate-700">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Cancelled</span>
          </span>
        );
      default:
        return null;
    }
  };

  const renderBookingCard = (b: any) => {
    const start = new Date(b.start_at);
    const end = new Date(b.end_at);
    const durationStr = formatDistanceStrict(end, start);

    return (
      <div
        key={b.id}
        className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors shadow-sm space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xs uppercase font-mono px-2 py-0.5 rounded-md bg-slate-800 text-indigo-300 border border-slate-700">
              {b.resource?.category || "Resource"}
            </span>
            <h3 className="text-base font-bold text-white tracking-wide">
              {b.resource?.name || "Campus Equipment"}
            </h3>
          </div>
          <div>{getStatusBadge(b.status, b.waitlist_rank)}</div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-1.5 text-slate-300">
            <CalendarClock className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="font-semibold text-white">{format(start, "EEE, MMM d, yyyy")}</span>
            <span>•</span>
            <span>
              {format(start, "h:mm a")} - {format(end, "h:mm a")} ({durationStr})
            </span>
          </div>

          {b.resource?.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="truncate">{b.resource.location}</span>
            </div>
          )}
        </div>

        {b.purpose && (
          <p className="text-xs text-slate-400 line-clamp-1 italic">
            &ldquo;{b.purpose}&rdquo;
          </p>
        )}

        {b.ext_status === "pending" && (
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-center justify-between">
            <span>Extension requested to {b.ext_requested_end_at ? format(new Date(b.ext_requested_end_at), "h:mm a") : ""}</span>
            <span className="text-[10px] uppercase font-mono bg-indigo-500/20 px-2 py-0.5 rounded">Pending Approval</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
          <span className="text-[11px] text-slate-500">
            Tier: <span className="text-slate-400 uppercase font-mono">{b.priority_tier}</span>
          </span>

          <Link
            href={`/bookings/${b.id}`}
            className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
          >
            <span>View Details &amp; Decision Breakdown</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  };

  return (
    <AuthenticatedLayout>
      <div className="space-y-8 max-w-5xl">
        <div className="border-b border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <CalendarClock className="w-6 h-6 text-indigo-400" />
              <span>My Campus Reservations</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Track upcoming sessions, monitor waitlist rankings, and view explainable decision breakdowns.
            </p>
          </div>

          <Link
            href="/resources"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Book New Resource</span>
          </Link>
        </div>

        {/* 1. Active In-Use Sessions */}
        {activeBookings.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Currently In Use ({activeBookings.length})</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeBookings.map(renderBookingCard)}
            </div>
          </section>
        )}

        {/* 2. Upcoming Confirmed Reservations */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-indigo-300">
            Confirmed Upcoming ({upcomingBookings.length})
          </h2>
          {upcomingBookings.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-500">
              No confirmed upcoming reservations.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingBookings.map(renderBookingCard)}
            </div>
          )}
        </section>

        {/* 3. Awaiting Review & Waitlisted */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-300">
            Awaiting Review &amp; Waitlist ({pendingBookings.length})
          </h2>
          {pendingBookings.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-500">
              No pending or waitlisted requests.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingBookings.map(renderBookingCard)}
            </div>
          )}
        </section>

        {/* 4. Past & History */}
        {pastBookings.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Reservation History ({pastBookings.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pastBookings.map(renderBookingCard)}
            </div>
          </section>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
