"use client";

import React, { useState, useTransition } from "react";
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  Building,
  ChevronDown,
  ChevronUp,
  Loader2,
  Star,
  ArrowDown,
  Calendar,
  MapPin,
  AlertCircle,
  RotateCcw,
  Timer,
} from "lucide-react";
import { format, formatDistanceStrict, differenceInMinutes } from "date-fns";
import { reviewBookingAction } from "@/actions/review";
import { approveExtensionAction } from "@/actions/review";
import { useToast } from "@/components/ui/toast";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BookingCardData {
  id: string;
  status: string;
  priority_tier: string;
  purpose: string | null;
  start_at: string;
  end_at: string;
  created_at: string;
  decision_reason: string | null;
  system_check: any;
  waitlist_rank: number | null;
  resource: {
    id: string;
    name: string;
    category: string;
    location: string | null;
    buffer_minutes: number;
  };
  user: {
    id: string;
    full_name: string | null;
    email: string | null;
    department: string | null;
    strikes: number;
  };
  weekly_hours_used?: number;
  ext_requested_end_at?: string | null;
  suspicious_patterns?: string[];
  strike_threshold?: number;
}

interface ReviewQueuePanelProps {
  pendingBookings: BookingCardData[];
  waitlistedBookings: BookingCardData[];
  extensionBookings: BookingCardData[];
  viewerRole: string;
  viewerId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function priorityBadge(tier: string) {
  const map: Record<string, { label: string; cls: string }> = {
    coursework: { label: "Coursework", cls: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" },
    research: { label: "Research", cls: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
    personal: { label: "Personal", cls: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
  };
  const v = map[tier] || { label: tier, cls: "bg-slate-500/20 text-slate-300 border-slate-500/30" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${v.cls}`}>
      {v.label}
    </span>
  );
}

function categoryBadge(cat: string) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700/60 text-slate-300 border border-slate-600/40">
      {cat}
    </span>
  );
}

function initials(name: string | null | undefined, email: string | null | undefined): string {
  if (name) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "??";
}

function durationLabel(startAt: string, endAt: string) {
  const mins = differenceInMinutes(new Date(endAt), new Date(startAt));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── System Check Panel ──────────────────────────────────────────────────────

function SystemCheckPanel({ check }: { check: any }) {
  if (!check) return null;

  const rows: { icon: React.ReactNode; label: string; detail?: string; status: "ok" | "warn" | "error" }[] = [];

  // Eligibility
  const elig = check.eligibility;
  if (elig) {
    const pendingCount = elig.pending_count || 0;
    rows.push({
      status: elig.eligible ? "ok" : pendingCount > 0 ? "warn" : "error",
      label: "Eligibility",
      detail: elig.eligible
        ? "All requirements met"
        : pendingCount > 0
        ? `${pendingCount} credential(s) pending`
        : elig.reason || "Not eligible",
      icon: null,
    });
  } else {
    rows.push({ status: "ok", label: "Eligibility", detail: "Not checked", icon: null });
  }

  // Active cap
  const activeCap = check.active_cap;
  if (activeCap) {
    rows.push({
      status: activeCap.ok ? "ok" : "error",
      label: "Active Bookings Cap",
      detail: `${activeCap.current ?? "?"} of ${activeCap.max ?? "?"} active`,
      icon: null,
    });
  }

  // Weekly cap
  const weeklyCap = check.weekly_cap;
  if (weeklyCap) {
    rows.push({
      status: weeklyCap.ok ? "ok" : "warn",
      label: "Weekly Usage",
      detail: `${weeklyCap.used ?? 0} of ${weeklyCap.max ?? 8} hrs`,
      icon: null,
    });
  }

  // Conflict
  const conflict = check.conflict;
  if (conflict !== undefined) {
    rows.push({
      status: conflict?.has_conflict ? "error" : "ok",
      label: "No Slot Conflict",
      detail: conflict?.has_conflict ? "Overlap detected" : "Slot available",
      icon: null,
    });
  }

  // Credential pending
  const credPending = check.credential_pending;

  const statusIcon = (s: "ok" | "warn" | "error") => {
    if (s === "ok") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    if (s === "warn") return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    return <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
  };

  return (
    <div className="mt-3 rounded-lg bg-slate-900/60 border border-slate-700/50 p-3 space-y-1.5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">System Check</p>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          {statusIcon(r.status)}
          <span className="text-xs text-slate-300 flex-1">{r.label}</span>
          {r.detail && <span className="text-xs text-slate-500">{r.detail}</span>}
        </div>
      ))}
      {credPending && (
        <div className="flex items-center gap-2 mt-1">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-xs text-amber-300">Credential pending verification</span>
        </div>
      )}
    </div>
  );
}

// ─── Action Panel ─────────────────────────────────────────────────────────────

type ActionType = "approve" | "reject" | "waitlist" | null;

function ActionPanel({
  bookingId,
  onSuccess,
}: {
  bookingId: string;
  onSuccess: () => void;
}) {
  const [activeAction, setActiveAction] = useState<ActionType>(null);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [inlineError, setInlineError] = useState<string | null>(null);
  const { success, error: toastError } = useToast();

  const handleDecision = (decision: "approved" | "rejected" | "waitlisted") => {
    setInlineError(null);
    startTransition(async () => {
      const res = await reviewBookingAction(bookingId, decision, reason.trim());
      if (res.ok) {
        const labels: Record<string, string> = {
          approved: "Booking approved.",
          rejected: "Booking rejected.",
          waitlisted: "Booking moved to waitlist.",
        };
        success(labels[decision] || "Action completed.");
        onSuccess();
        setActiveAction(null);
        setReason("");
      } else {
        setInlineError(res.error);
        if (!res.error.toLowerCase().includes("conflict")) {
          toastError(res.error);
        }
      }
    });
  };

  const decisionMap = {
    approve: { label: "Approve", cls: "bg-emerald-600 hover:bg-emerald-500 text-white", decision: "approved" as const },
    reject: { label: "Reject", cls: "bg-rose-600 hover:bg-rose-500 text-white", decision: "rejected" as const },
    waitlist: { label: "Move to Waitlist", cls: "bg-amber-600 hover:bg-amber-500 text-white", decision: "waitlisted" as const },
  };

  if (!activeAction) {
    return (
      <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-700/50 mt-3">
        <button
          onClick={() => setActiveAction("approve")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 transition-colors text-xs font-medium"
        >
          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
        </button>
        <button
          onClick={() => setActiveAction("reject")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/20 border border-rose-500/30 text-rose-300 hover:bg-rose-600/30 transition-colors text-xs font-medium"
        >
          <XCircle className="w-3.5 h-3.5" /> Reject
        </button>
        <button
          onClick={() => setActiveAction("waitlist")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/20 border border-amber-500/30 text-amber-300 hover:bg-amber-600/30 transition-colors text-xs font-medium"
        >
          <Clock className="w-3.5 h-3.5" /> Waitlist
        </button>
      </div>
    );
  }

  const actionConfig = decisionMap[activeAction];
  const requiresReason = activeAction === "reject" || activeAction === "waitlist";

  return (
    <div className="pt-3 border-t border-slate-700/50 mt-3 space-y-3">
      {inlineError && (
        <div className="rounded-lg bg-rose-900/30 border border-rose-500/30 p-3 space-y-2">
          <p className="text-xs text-rose-300">{inlineError}</p>
          {inlineError.toLowerCase().includes("conflict") && (
            <button
              onClick={() => {
                setInlineError(null);
                setActiveAction("waitlist");
                setReason("Slot conflict detected — moving to waitlist");
              }}
              className="text-xs text-amber-300 underline hover:text-amber-200"
            >
              Move to waitlist instead →
            </button>
          )}
        </div>
      )}

      <div>
        <label className="block text-xs text-slate-400 mb-1.5 font-medium">
          {requiresReason ? "Reason (required, min 10 chars)" : "Note for applicant (optional)"}
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder={requiresReason ? "Provide a reason..." : "Optional note..."}
          className="w-full rounded-lg bg-slate-800 border border-slate-600 text-slate-200 text-xs px-3 py-2 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => handleDecision(actionConfig.decision)}
          disabled={isPending || (requiresReason && reason.trim().length < 10)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${actionConfig.cls}`}
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {isPending ? "Processing..." : `Confirm: ${actionConfig.label}`}
        </button>
        <button
          onClick={() => { setActiveAction(null); setReason(""); setInlineError(null); }}
          disabled={isPending}
          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Booking Card ─────────────────────────────────────────────────────────────

function BookingCard({
  booking,
  showRank,
  showActions,
  onRemove,
}: {
  booking: BookingCardData;
  showRank?: boolean;
  showActions?: boolean;
  onRemove: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const initStr = initials(booking.user.full_name, booking.user.email);
  const dur = durationLabel(booking.start_at, booking.end_at);
  const startFormatted = format(new Date(booking.start_at), "EEE, MMM d · h:mm a");
  const endFormatted = format(new Date(booking.end_at), "h:mm a");
  const submittedAgo = formatDistanceStrict(new Date(booking.created_at), new Date(), { addSuffix: true });

  const scoreBreakdown = booking.system_check?.priority_score;

  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3 hover:border-slate-700 transition-colors">
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
          {initStr}
        </div>

        {/* User info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">
              {booking.user.full_name || booking.user.email || "Unknown User"}
            </span>
            {booking.user.strikes >= (booking.strike_threshold || 3) ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600/30 text-rose-200 border border-rose-500 animate-pulse">
                ⚠ High strike count ({booking.user.strikes})
              </span>
            ) : booking.user.strikes > 0 ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                ⚠ {booking.user.strikes} strike{booking.user.strikes !== 1 ? "s" : ""}
              </span>
            ) : null}
            {showRank && booking.waitlist_rank && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-600/20 border border-indigo-500/30 text-indigo-300">
                <Star className="w-3 h-3" />#{booking.waitlist_rank}
              </span>
            )}
          </div>
          {booking.user.department && (
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
              <Building className="w-3 h-3" /> {booking.user.department}
            </p>
          )}
        </div>

        {/* Priority tier badge */}
        <div className="shrink-0">{priorityBadge(booking.priority_tier)}</div>
      </div>

      {/* Resource row */}
      <div className="flex items-start gap-2 flex-wrap">
        <span className="text-sm font-medium text-white">{booking.resource.name}</span>
        {categoryBadge(booking.resource.category)}
        {booking.resource.location && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="w-3 h-3" /> {booking.resource.location}
          </span>
        )}
      </div>

      {/* Time row */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        <span>{startFormatted} – {endFormatted}</span>
        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300 border border-slate-700 font-medium">
          {dur}
        </span>
      </div>

      {/* Purpose */}
      {booking.purpose && (
        <div>
          <p className={`text-xs text-slate-400 leading-relaxed ${!expanded ? "line-clamp-2" : ""}`}>
            <span className="text-slate-500 font-medium">Purpose: </span>
            {booking.purpose}
          </p>
          {booking.purpose.length > 120 && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-xs text-indigo-400 hover:text-indigo-300 mt-0.5 flex items-center gap-1"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {/* System check */}
      <SystemCheckPanel check={booking.system_check} />

      {/* Suspicious usage pattern chips */}
      {booking.suspicious_patterns && booking.suspicious_patterns.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-slate-950 border border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            Advisory Flags:
          </span>
          {booking.suspicious_patterns.map((chip, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20"
            >
              <span>{chip}</span>
            </span>
          ))}
        </div>
      )}

      {/* Waitlist score breakdown */}
      {showRank && scoreBreakdown && (
        <div className="rounded-lg bg-slate-800/60 border border-slate-700/40 p-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Priority Score</p>
          <p className="text-xs text-slate-300">{scoreBreakdown.breakdown || `${scoreBreakdown.score} points`}</p>
        </div>
      )}

      {/* Footer: submitted time */}
      <p className="text-[10px] text-slate-600">Submitted {submittedAgo}</p>

      {/* Actions */}
      {showActions && (
        <ActionPanel bookingId={booking.id} onSuccess={() => onRemove(booking.id)} />
      )}
    </div>
  );
}

// ─── Extension Card ───────────────────────────────────────────────────────────

function ExtensionCard({
  booking,
  onRemove,
}: {
  booking: BookingCardData;
  onRemove: (id: string) => void;
}) {
  const [activeAction, setActiveAction] = useState<"approve" | "reject" | null>(null);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [inlineError, setInlineError] = useState<string | null>(null);
  const { success, error: toastError } = useToast();

  const handleExtension = (approve: boolean) => {
    setInlineError(null);
    startTransition(async () => {
      const res = await approveExtensionAction(booking.id, approve, reason || undefined);
      if (res.ok) {
        success(approve ? "Extension approved." : "Extension rejected.");
        onRemove(booking.id);
      } else {
        setInlineError(res.error);
        toastError(res.error);
      }
    });
  };

  const initStr = initials(booking.user.full_name, booking.user.email);

  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3 hover:border-slate-700 transition-colors">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-amber-300 shrink-0">
          {initStr}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{booking.user.full_name || booking.user.email}</p>
          {booking.user.department && (
            <p className="text-xs text-slate-500">{booking.user.department}</p>
          )}
        </div>
        <div className="ml-auto">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Timer className="w-3 h-3" /> Extension Request
          </span>
        </div>
      </div>

      {/* Resource */}
      <div>
        <p className="text-sm font-medium text-white">{booking.resource.name}</p>
        <p className="text-xs text-slate-500">{booking.resource.category}{booking.resource.location ? ` · ${booking.resource.location}` : ""}</p>
      </div>

      {/* Time details */}
      <div className="rounded-lg bg-slate-800/60 border border-slate-700/40 p-3 space-y-1.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 w-28 shrink-0">Current end time</span>
          <span className="text-slate-300">{format(new Date(booking.end_at), "EEE, MMM d · h:mm a")}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 w-28 shrink-0">Requested end</span>
          <span className="text-amber-300 font-medium">
            {booking.ext_requested_end_at
              ? format(new Date(booking.ext_requested_end_at), "EEE, MMM d · h:mm a")
              : "N/A"}
          </span>
        </div>
        {booking.ext_requested_end_at && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 w-28 shrink-0">Extension length</span>
            <span className="text-slate-300">
              +{durationLabel(booking.end_at, booking.ext_requested_end_at)}
            </span>
          </div>
        )}
      </div>

      {/* Error */}
      {inlineError && (
        <div className="rounded-lg bg-rose-900/30 border border-rose-500/30 p-3">
          <p className="text-xs text-rose-300">{inlineError}</p>
        </div>
      )}

      {/* Actions */}
      {!activeAction ? (
        <div className="flex gap-2 pt-2 border-t border-slate-700/50">
          <button
            onClick={() => setActiveAction("approve")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 transition-colors text-xs font-medium"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
          </button>
          <button
            onClick={() => setActiveAction("reject")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/20 border border-rose-500/30 text-rose-300 hover:bg-rose-600/30 transition-colors text-xs font-medium"
          >
            <XCircle className="w-3.5 h-3.5" /> Reject
          </button>
        </div>
      ) : (
        <div className="pt-2 border-t border-slate-700/50 space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder={activeAction === "reject" ? "Reason for rejection (optional)..." : "Optional note..."}
            className="w-full rounded-lg bg-slate-800 border border-slate-600 text-slate-200 text-xs px-3 py-2 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleExtension(activeAction === "approve")}
              disabled={isPending}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                activeAction === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "bg-rose-600 hover:bg-rose-500 text-white"
              }`}
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Confirm
            </button>
            <button
              onClick={() => { setActiveAction(null); setReason(""); }}
              disabled={isPending}
              className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

function Tab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
        active
          ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function ReviewQueuePanel({
  pendingBookings: initialPending,
  waitlistedBookings: initialWaitlisted,
  extensionBookings: initialExtensions,
  viewerRole,
  viewerId,
}: ReviewQueuePanelProps) {
  const [pending, setPending] = useState<BookingCardData[]>(initialPending);
  const [waitlisted, setWaitlisted] = useState<BookingCardData[]>(initialWaitlisted);
  const [extensions, setExtensions] = useState<BookingCardData[]>(initialExtensions);
  const [activeTab, setActiveTab] = useState<"pending" | "waitlisted" | "extensions">("pending");

  const removeFromPending = (id: string) => setPending((prev) => prev.filter((b) => b.id !== id));
  const removeFromWaitlisted = (id: string) => setWaitlisted((prev) => prev.filter((b) => b.id !== id));
  const removeFromExtensions = (id: string) => setExtensions((prev) => prev.filter((b) => b.id !== id));

  const hasTopWaitlisted = waitlisted.some((b) => b.waitlist_rank === 1);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <ClipboardCheck className="w-6 h-6 text-indigo-400" />
          <span>Reservation Review Queue</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Review and approve pending student reservations according to priority tier and purpose.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <Tab
          label={`Pending Review (${pending.length})`}
          active={activeTab === "pending"}
          onClick={() => setActiveTab("pending")}
        />
        <Tab
          label={`Waitlisted (${waitlisted.length})`}
          active={activeTab === "waitlisted"}
          onClick={() => setActiveTab("waitlisted")}
        />
        <Tab
          label={`Extension Requests (${extensions.length})`}
          active={activeTab === "extensions"}
          onClick={() => setActiveTab("extensions")}
        />
      </div>

      {/* Waitlist banner */}
      {activeTab === "waitlisted" && hasTopWaitlisted && (
        <div className="flex items-center gap-3 rounded-xl bg-indigo-900/30 border border-indigo-500/30 px-4 py-3">
          <Star className="w-4 h-4 text-indigo-400 shrink-0" />
          <p className="text-sm text-indigo-300 font-medium">
            Slot may be available — top ranked request ready for review
          </p>
        </div>
      )}

      {/* Tab content */}
      {activeTab === "pending" && (
        <div className="space-y-4">
          {pending.length === 0 ? (
            <EmptyState icon={<ClipboardCheck className="w-6 h-6" />} title="No pending reviews" description="All incoming reservation requests have been processed." />
          ) : (
            pending.map((b) => (
              <BookingCard key={b.id} booking={b} showActions onRemove={removeFromPending} />
            ))
          )}
        </div>
      )}

      {activeTab === "waitlisted" && (
        <div className="space-y-4">
          {waitlisted.length === 0 ? (
            <EmptyState icon={<Clock className="w-6 h-6" />} title="No waitlisted bookings" description="There are no bookings currently on the waitlist." />
          ) : (
            waitlisted
              .slice()
              .sort((a, b) => (a.waitlist_rank ?? 999) - (b.waitlist_rank ?? 999))
              .map((b) => (
                <BookingCard key={b.id} booking={b} showRank showActions onRemove={removeFromWaitlisted} />
              ))
          )}
        </div>
      )}

      {activeTab === "extensions" && (
        <div className="space-y-4">
          {extensions.length === 0 ? (
            <EmptyState icon={<Timer className="w-6 h-6" />} title="No extension requests" description="There are no pending extension requests." />
          ) : (
            extensions.map((b) => (
              <ExtensionCard key={b.id} booking={b} onRemove={removeFromExtensions} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-10 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
      <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
        {icon}
      </div>
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <p className="text-sm text-slate-400 max-w-md mx-auto">{description}</p>
    </div>
  );
}
