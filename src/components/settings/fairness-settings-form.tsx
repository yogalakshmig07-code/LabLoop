"use client";

import React, { useState } from "react";
import { updateFairnessSettingsAction, FairnessSettingsInput } from "@/actions/settings";
import {
  Scale,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Layers,
  Sparkles,
  Save,
  CheckCircle2,
  Info,
} from "lucide-react";

interface FairnessSettingsFormProps {
  initialSettings: {
    max_active_bookings: number;
    max_hours_per_week_per_category: number;
    strike_threshold: number;
    reminder_minutes_before: number;
  };
}

export function FairnessSettingsForm({ initialSettings }: FairnessSettingsFormProps) {
  const [formData, setFormData] = useState<FairnessSettingsInput>(initialSettings);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setToastMessage(null);

    try {
      const res = await updateFairnessSettingsAction(formData);
      if (res.ok) {
        setToastMessage({
          type: "success",
          text: "Fairness parameters successfully updated and logged in the audit trail.",
        });
      } else {
        setToastMessage({
          type: "error",
          text: res.error || "Failed to update settings.",
        });
      }
    } catch (err: any) {
      setToastMessage({
        type: "error",
        text: err.message || "An unexpected error occurred.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Toast Notice */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`p-4 rounded-xl flex items-center justify-between gap-3 border shadow-md animate-in fade-in slide-in-from-top-2 ${
            toastMessage.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
              : "bg-rose-950/40 border-rose-500/40 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            {toastMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSubmit} className="p-6 sm:p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-indigo-400" />
            <span>Campus Quota &amp; Policy Parameters</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Global fairness constraints applied across all campus labs, maker equipment, and specialized research benches.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Max Active Bookings */}
          <div className="space-y-2">
            <label htmlFor="max_active_bookings" className="block text-xs font-semibold text-slate-300">
              Max Active Concurrent Bookings
            </label>
            <input
              id="max_active_bookings"
              type="number"
              min={1}
              max={20}
              required
              value={formData.max_active_bookings}
              onChange={(e) =>
                setFormData({ ...formData, max_active_bookings: parseInt(e.target.value) || 1 })
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-500">
              Maximum simultaneous approved or pending reservations permitted per student (Prevents hoarding slots).
            </p>
          </div>

          {/* Weekly Hours Cap per Category */}
          <div className="space-y-2">
            <label htmlFor="max_hours_per_week_per_category" className="block text-xs font-semibold text-slate-300">
              Weekly Allocation Cap per Category (Hours)
            </label>
            <input
              id="max_hours_per_week_per_category"
              type="number"
              min={1}
              max={168}
              required
              value={formData.max_hours_per_week_per_category}
              onChange={(e) =>
                setFormData({ ...formData, max_hours_per_week_per_category: parseInt(e.target.value) || 1 })
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-500">
              Maximum cumulative hours a student can reserve in a single equipment category per calendar week.
            </p>
          </div>

          {/* Strike Threshold */}
          <div className="space-y-2">
            <label htmlFor="strike_threshold" className="block text-xs font-semibold text-slate-300">
              Reliability Review Strike Threshold
            </label>
            <input
              id="strike_threshold"
              type="number"
              min={1}
              max={10}
              required
              value={formData.strike_threshold}
              onChange={(e) =>
                setFormData({ ...formData, strike_threshold: parseInt(e.target.value) || 1 })
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-500">
              Number of unaddressed strikes that flags accounts in the custodian review queue for extra scrutiny.
            </p>
          </div>

          {/* Reminder Lead Time */}
          <div className="space-y-2">
            <label htmlFor="reminder_minutes_before" className="block text-xs font-semibold text-slate-300">
              Reminder Notification Lead Time (Minutes)
            </label>
            <input
              id="reminder_minutes_before"
              type="number"
              min={5}
              max={1440}
              required
              value={formData.reminder_minutes_before}
              onChange={(e) =>
                setFormData({ ...formData, reminder_minutes_before: parseInt(e.target.value) || 5 })
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-500">
              Minutes prior to booking start time when an automated reminder notification is issued.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Save className="w-4 h-4" />
            <span>{isSubmitting ? "Saving Quotas..." : "Save Policy Changes"}</span>
          </button>
        </div>
      </form>

      {/* Transparent Waitlist Algorithm Breakdown Card */}
      <section className="p-6 sm:p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
          <Info className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-bold text-white">How Waitlist Ranking Works: Plain-Language Formula</h3>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          When competing reservation requests overlap for the same scarce equipment slot, LabLoop ranks candidates using an open, non-discriminatory formula.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {/* 1. Priority Tier Points */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="text-xs font-bold text-indigo-400">1. Priority Tier Base</div>
            <ul className="text-[11px] text-slate-300 space-y-1">
              <li>• Coursework: <strong className="text-white font-mono">100 pts</strong></li>
              <li>• Research: <strong className="text-white font-mono">70 pts</strong></li>
              <li>• Personal: <strong className="text-white font-mono">30 pts</strong></li>
            </ul>
            <p className="text-[10px] text-slate-500">Academic curriculum work takes highest priority.</p>
          </div>

          {/* 2. Recent Usage Decay */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="text-xs font-bold text-cyan-400">2. Least Recent Usage</div>
            <div className="text-[11px] text-slate-300 font-mono">
              -5 pts per hour used
            </div>
            <p className="text-[10px] text-slate-500">
              Evaluates total booked hours in the same category over the last 7 days to prevent resource monopolies.
            </p>
          </div>

          {/* 3. Reliability Strikes */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="text-xs font-bold text-amber-400">3. Strikes Penalty</div>
            <div className="text-[11px] text-slate-300 font-mono">
              -25 pts per active strike
            </div>
            <p className="text-[10px] text-slate-500">
              Lowers waitlist rank, but <strong>never blocks</strong> booking requests automatically. Humans review every penalty.
            </p>
          </div>

          {/* 4. FIFO Tie-breaker */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="text-xs font-bold text-emerald-400">4. FIFO Tie-Breaking</div>
            <div className="text-[11px] text-slate-300 font-mono">
              Timestamp sorting
            </div>
            <p className="text-[10px] text-slate-500">
              When two applicants hold identical priority scores, the earlier request submission timestamp takes precedence.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

