"use client";

import React, { useState, useEffect, useRef, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Clock,
  ClipboardList,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  CalendarClock,
  RefreshCw,
  Info,
  AlertTriangle,
} from "lucide-react";
import { format, addDays } from "date-fns";
import { useToast } from "@/components/ui/toast";
import { preCheckBookingAction, createBookingRequest, PreCheckInput } from "@/actions/bookings";
import type { PreCheckResult } from "@/lib/bookings";
import type { AlternativeSlot } from "@/lib/bookings";

export interface RequestFormProps {
  resource: {
    id: string;
    name: string;
    category: string;
    location: string | null;
    max_duration_hours: number;
    buffer_minutes: number;
    usage_rules: string | null;
    deposit_note: string | null;
    requires_supervision: boolean;
    availability_windows: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>;
  };
}

const PRIORITY_TIERS = [
  {
    value: "coursework",
    label: "Coursework",
    description: "Required for an active course or academic assignment.",
    score: "100 base pts",
    color: "indigo",
  },
  {
    value: "research",
    label: "Research",
    description: "Supervised research project or thesis work.",
    score: "70 base pts",
    color: "violet",
  },
  {
    value: "personal",
    label: "Personal / Exploratory",
    description: "Self-directed study, personal projects, or skill building.",
    score: "30 base pts",
    color: "slate",
  },
] as const;

type PriorityTierValue = (typeof PRIORITY_TIERS)[number]["value"];

function getTomorrow(): string {
  return format(addDays(new Date(), 1), "yyyy-MM-dd");
}

function getToday(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface CheckRowProps {
  label: string;
  status: "ok" | "fail" | "warn" | "loading" | "idle";
  detail?: string;
}

function CheckRow({ label, status, detail }: CheckRowProps) {
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-slate-800/60 last:border-0">
      <span className="mt-0.5 shrink-0">
        {status === "ok" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
        {status === "fail" && <XCircle className="w-4 h-4 text-rose-400" />}
        {status === "warn" && <AlertCircle className="w-4 h-4 text-amber-400" />}
        {status === "loading" && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
        {status === "idle" && <div className="w-4 h-4 rounded-full border border-slate-600" />}
      </span>
      <div className="flex-1 min-w-0">
        <span
          className={`text-xs font-medium ${
            status === "ok"
              ? "text-emerald-300"
              : status === "fail"
              ? "text-rose-300"
              : status === "warn"
              ? "text-amber-300"
              : "text-slate-400"
          }`}
        >
          {label}
        </span>
        {detail && <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{detail}</p>}
      </div>
    </div>
  );
}

export function RequestForm({ resource }: RequestFormProps) {
  const router = useRouter();
  const { toast, error: toastError, success: toastSuccess } = useToast();
  const [isPending, startTransition] = useTransition();

  // Form state
  const [date, setDate] = useState(getTomorrow());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [purpose, setPurpose] = useState("");
  const [priorityTier, setPriorityTier] = useState<PriorityTierValue>("coursework");
  const [rulesAcknowledged, setRulesAcknowledged] = useState(false);
  const [joinWaitlist, setJoinWaitlist] = useState(false);

  // Pre-check state
  const [preCheck, setPreCheck] = useState<PreCheckResult | null>(null);
  const [preCheckLoading, setPreCheckLoading] = useState(false);
  const [preCheckError, setPreCheckError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Submission result
  const [submitted, setSubmitted] = useState<{
    bookingId: string;
    status: string;
    message: string;
  } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showConflictPanel, setShowConflictPanel] = useState(false);

  // Computed duration
  const durationHours = React.useMemo(() => {
    const s = new Date(`${date}T${startTime}:00`);
    const e = new Date(`${date}T${endTime}:00`);
    if (e > s) return (e.getTime() - s.getTime()) / (1000 * 60 * 60);
    return 0;
  }, [date, startTime, endTime]);

  const overMaxDuration = durationHours > resource.max_duration_hours && durationHours > 0;

  // ── Pre-check debounce ──────────────────────────────────────────────────
  const runPreCheck = useCallback(
    async (d: string, st: string, et: string) => {
      if (!d || !st || !et) return;
      setPreCheckLoading(true);
      setPreCheckError(null);
      try {
        const result = await preCheckBookingAction({
          resource_id: resource.id,
          date: d,
          start_time: st,
          end_time: et,
        });
        if (result.ok) {
          setPreCheck(result.data);
          // Reset join waitlist if no conflict
          if (!result.data.hasConflict) setJoinWaitlist(false);
        } else {
          setPreCheckError(result.error);
          setPreCheck(null);
        }
      } catch {
        setPreCheckError("Pre-check failed. Please try again.");
        setPreCheck(null);
      } finally {
        setPreCheckLoading(false);
      }
    },
    [resource.id]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runPreCheck(date, startTime, endTime);
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [date, startTime, endTime, runPreCheck]);

  // ── Apply alternative slot ──────────────────────────────────────────────
  function applyAlternativeSlot(slot: AlternativeSlot) {
    const start = new Date(slot.start_at);
    const end = new Date(slot.end_at);
    setDate(format(start, "yyyy-MM-dd"));
    setStartTime(format(start, "HH:mm"));
    setEndTime(format(end, "HH:mm"));
    setJoinWaitlist(false);
    toast("Slot applied. Review and submit.", "info");
  }

  // ── Submit ──────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    setShowConflictPanel(false);

    const fd = new FormData();
    fd.set("resource_id", resource.id);
    fd.set("date", date);
    fd.set("start_time", startTime);
    fd.set("end_time", endTime);
    fd.set("purpose", purpose);
    fd.set("priority_tier", priorityTier);
    fd.set("rules_acknowledged", rulesAcknowledged ? "true" : "false");
    fd.set("join_waitlist_if_conflict", joinWaitlist ? "true" : "false");

    startTransition(async () => {
      const result = await createBookingRequest(fd);
      if (result.ok) {
        setSubmitted(result.data);
        toastSuccess(result.data.message);
      } else {
        // Check for conflict error → show conflict panel
        if (result.error.toLowerCase().includes("conflict")) {
          setShowConflictPanel(true);
        }
        setSubmitError(result.error);
        toastError(result.error);
      }
    });
  }

  // ── Can submit? ─────────────────────────────────────────────────────────
  const canSubmit =
    !isPending &&
    rulesAcknowledged &&
    purpose.length >= 15 &&
    durationHours > 0 &&
    !overMaxDuration &&
    (preCheck
      ? preCheck.inFuture &&
        preCheck.withinOperatingHours &&
        preCheck.withinMaxDuration &&
        preCheck.activeCapOk &&
        preCheck.weeklyCapOk &&
        preCheck.missingRequirements.length === 0
      : true);

  // ── Confirmation view ───────────────────────────────────────────────────
  if (submitted) {
    const isWaitlisted = submitted.status === "waitlisted";
    return (
      <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-5">
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${
            isWaitlisted
              ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
              : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
          }`}
        >
          {isWaitlisted ? (
            <CalendarClock className="w-7 h-7" />
          ) : (
            <CheckCircle2 className="w-7 h-7" />
          )}
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">
            {isWaitlisted ? "Added to Waitlist" : "Request Submitted!"}
          </h2>
          <p className="text-sm text-slate-400 mt-1.5 max-w-md mx-auto">{submitted.message}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => router.push("/bookings")}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
          >
            <span>View My Bookings</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => router.push(`/resources/${resource.id}`)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
          >
            Back to Resource
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Resource info banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
          <CalendarClock className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{resource.name}</p>
          <p className="text-xs text-slate-500">
            {resource.location ? `${resource.location} · ` : ""}
            Max {resource.max_duration_hours}h · {resource.buffer_minutes}min buffer
          </p>
        </div>
        {resource.requires_supervision && (
          <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-semibold shrink-0">
            Supervision Required
          </span>
        )}
      </div>

      {/* Date & Time */}
      <section className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-indigo-400" />
          Session Date & Time
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-medium">Date</label>
            <input
              type="date"
              value={date}
              min={getToday()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-medium">Start Time (HH:MM)</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-medium">End Time (HH:MM)</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>
        </div>

        {/* Duration display */}
        {durationHours > 0 && (
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
              overMaxDuration
                ? "bg-rose-500/10 border border-rose-500/20 text-rose-300"
                : "bg-slate-800 text-slate-300"
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>
              Duration: {formatDuration(durationHours)}
              {overMaxDuration && ` — exceeds max ${resource.max_duration_hours}h limit`}
            </span>
          </div>
        )}
      </section>

      {/* Live Pre-Check Panel */}
      <section className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            Live Slot Validation
          </h2>
          {preCheckLoading && (
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Checking…
            </span>
          )}
        </div>

        {preCheckError && (
          <div className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {preCheckError}
          </div>
        )}

        {!preCheck && !preCheckLoading && !preCheckError && (
          <p className="text-xs text-slate-500">Select date and times above to see live validation.</p>
        )}

        {(preCheck || preCheckLoading) && (
          <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3 space-y-0.5">
            <CheckRow
              label="Future slot"
              status={preCheckLoading ? "loading" : preCheck ? (preCheck.inFuture ? "ok" : "fail") : "idle"}
              detail={!preCheck?.inFuture && !preCheckLoading ? "Start time must be in the future." : undefined}
            />
            <CheckRow
              label="Within operating hours"
              status={preCheckLoading ? "loading" : preCheck ? (preCheck.withinOperatingHours ? "ok" : "fail") : "idle"}
              detail={preCheck && !preCheckLoading ? preCheck.operatingHoursReason : undefined}
            />
            <CheckRow
              label="Duration valid"
              status={
                preCheckLoading
                  ? "loading"
                  : preCheck
                  ? preCheck.withinMaxDuration && durationHours > 0
                    ? "ok"
                    : "fail"
                  : "idle"
              }
              detail={
                preCheck && !preCheck.withinMaxDuration
                  ? `Max duration is ${preCheck.maxDurationHours}h.`
                  : undefined
              }
            />
            <CheckRow
              label="Active booking cap"
              status={preCheckLoading ? "loading" : preCheck ? (preCheck.activeCapOk ? "ok" : "fail") : "idle"}
              detail={preCheck && !preCheckLoading ? preCheck.activeCapReason : undefined}
            />
            <CheckRow
              label="Weekly hours cap"
              status={preCheckLoading ? "loading" : preCheck ? (preCheck.weeklyCapOk ? "ok" : "warn") : "idle"}
              detail={preCheck && !preCheckLoading ? preCheck.weeklyCapReason : undefined}
            />
            <CheckRow
              label="No scheduling conflict"
              status={
                preCheckLoading
                  ? "loading"
                  : preCheck
                  ? preCheck.hasConflict
                    ? "warn"
                    : "ok"
                  : "idle"
              }
              detail={preCheck?.conflictReason}
            />
          </div>
        )}

        {/* Conflict panel */}
        {(preCheck?.hasConflict || showConflictPanel) && !preCheckLoading && (
          <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-300">Slot Conflict Detected</p>
                <p className="text-[11px] text-amber-300/70 mt-0.5">
                  This slot overlaps with an existing approved booking. You can join the waitlist
                  or choose an alternative.
                </p>
              </div>
            </div>

            {/* Join waitlist toggle */}
            <button
              type="button"
              onClick={() => setJoinWaitlist((v) => !v)}
              className={`w-full px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                joinWaitlist
                  ? "bg-amber-500/20 border-amber-500/40 text-amber-200"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:border-amber-500/30 hover:text-amber-300"
              }`}
            >
              {joinWaitlist ? "✓ Joining Waitlist for This Slot" : "Join Waitlist for This Slot"}
            </button>

            {/* Alternative slots */}
            {preCheck && preCheck.alternativeSlots.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] text-slate-400 font-medium">Or choose an alternative slot:</p>
                {preCheck.alternativeSlots.map((slot, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyAlternativeSlot(slot)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-indigo-500/40 transition-all text-left"
                  >
                    <div>
                      <p className="text-xs font-medium text-white">{slot.display_date}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{slot.display_time}</p>
                    </div>
                    <span className="text-[11px] text-indigo-400 font-medium">Choose →</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Missing requirements warning */}
        {preCheck && preCheck.missingRequirements.length > 0 && (
          <div className="rounded-xl bg-rose-500/5 border border-rose-500/20 p-3 space-y-1">
            <p className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
              <XCircle className="w-4 h-4" />
              Missing Prerequisites
            </p>
            <p className="text-[11px] text-rose-300/70">
              {preCheck.missingRequirements.join(", ")} — upload proof via your profile before submitting.
            </p>
          </div>
        )}

        {/* Pending requirements notice */}
        {preCheck && preCheck.pendingRequirements.length > 0 && (
          <div className="rounded-xl bg-cyan-500/5 border border-cyan-500/20 p-3 space-y-1">
            <p className="text-xs font-medium text-cyan-300 flex items-center gap-1.5">
              <Info className="w-4 h-4" />
              Pending Verification
            </p>
            <p className="text-[11px] text-cyan-300/70">
              {preCheck.pendingRequirements.join(", ")} — awaiting staff review. You may still submit.
            </p>
          </div>
        )}
      </section>

      {/* Purpose */}
      <section className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-indigo-400" />
          Session Purpose
        </h2>
        <div className="space-y-1.5">
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Describe your session in at least 15 characters (e.g. PCR run for BIO301 lab report, chapter 3 experiment…)"
            rows={4}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            required
          />
          <div className="flex justify-between items-center">
            <p className="text-[11px] text-slate-600">Minimum 15 characters</p>
            <span
              className={`text-[11px] font-mono ${
                purpose.length >= 15 ? "text-emerald-400" : "text-slate-500"
              }`}
            >
              {purpose.length} chars
            </span>
          </div>
        </div>
      </section>

      {/* Priority Tier */}
      <section className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            Priority Tier
          </h2>
          <p className="text-[11px] text-slate-500 mt-1 italic">
            Reviewers may verify the declared tier against your academic record. Misrepresentation
            affects priority scoring.
          </p>
        </div>

        <div className="space-y-2">
          {PRIORITY_TIERS.map((tier) => (
            <label
              key={tier.value}
              className={`flex items-start gap-3 p-3.5 rounded-xl cursor-pointer border transition-all ${
                priorityTier === tier.value
                  ? "bg-indigo-500/10 border-indigo-500/40"
                  : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
              }`}
            >
              <input
                type="radio"
                name="priority_tier"
                value={tier.value}
                checked={priorityTier === tier.value}
                onChange={() => setPriorityTier(tier.value)}
                className="mt-0.5 accent-indigo-500"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{tier.label}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    {tier.score}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{tier.description}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Usage Rules Acknowledgment */}
      <section className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          Usage Rules & Agreement
        </h2>

        {resource.usage_rules && (
          <div className="max-h-36 overflow-y-auto rounded-xl bg-slate-950/60 border border-slate-800 p-3.5 text-xs text-slate-400 leading-relaxed scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-slate-700">
            {resource.usage_rules}
          </div>
        )}

        {resource.deposit_note && (
          <div className="px-3.5 py-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-300/80 leading-relaxed">
            <span className="font-semibold text-amber-300">Deposit / Clearance Notice: </span>
            {resource.deposit_note}
          </div>
        )}

        <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer hover:border-indigo-500/30 transition-colors">
          <input
            type="checkbox"
            checked={rulesAcknowledged}
            onChange={(e) => setRulesAcknowledged(e.target.checked)}
            className="mt-0.5 accent-indigo-500 w-4 h-4 shrink-0"
          />
          <span className="text-xs text-slate-300 leading-relaxed">
            I have read and agree to the usage rules, safety guidelines, and terms above. I
            understand that violations may result in strikes or booking suspension.
          </span>
        </label>
      </section>

      {/* Submit error */}
      {submitError && !showConflictPanel && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{submitError}</p>
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={!canSubmit}
        className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2.5 ${
          canSubmit
            ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 hover:scale-[1.01] active:scale-[0.99]"
            : "bg-slate-800 text-slate-500 cursor-not-allowed"
        }`}
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Submitting Request…</span>
          </>
        ) : joinWaitlist ? (
          <>
            <CalendarClock className="w-4 h-4" />
            <span>Join Waitlist for This Slot</span>
          </>
        ) : (
          <>
            <ArrowRight className="w-4 h-4" />
            <span>Submit Booking Request</span>
          </>
        )}
      </button>

      {!canSubmit && !isPending && (
        <p className="text-center text-[11px] text-slate-600">
          {!rulesAcknowledged
            ? "Acknowledge usage rules to enable submission."
            : purpose.length < 15
            ? "Write a session purpose (15+ characters) to continue."
            : preCheck && preCheck.missingRequirements.length > 0
            ? "Upload missing prerequisite credentials before submitting."
            : overMaxDuration
            ? `Reduce session duration to max ${resource.max_duration_hours}h.`
            : "Fix validation errors above to continue."}
        </p>
      )}
    </form>
  );
}
