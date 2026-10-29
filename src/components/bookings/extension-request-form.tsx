"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Plus, Loader2, X, AlertCircle } from "lucide-react";
import { requestExtensionAction } from "@/actions/cancel-booking";
import { useToast } from "@/components/ui/toast";
import { format, addMinutes } from "date-fns";

interface ExtensionRequestFormProps {
  bookingId: string;
  currentEndAt: string;
}

export function ExtensionRequestForm({ bookingId, currentEndAt }: ExtensionRequestFormProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [additionalMinutes, setAdditionalMinutes] = useState(30);
  const [isPending, startTransition] = useTransition();

  const currentEndDate = new Date(currentEndAt);
  const newEndDate = addMinutes(currentEndDate, additionalMinutes);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await requestExtensionAction(bookingId, newEndDate.toISOString());
      if (res.ok) {
        success("Extension request submitted for staff review.");
        setIsOpen(false);
        router.refresh();
      } else {
        toastError(res.error || "Failed to request extension.");
      }
    });
  };

  return (
    <div>
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Request Session Extension</span>
        </button>
      ) : (
        <div className="p-4 rounded-xl bg-slate-900 border border-indigo-500/30 space-y-3 mt-2 max-w-md">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-indigo-400">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-bold text-white">Extend Reservation</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Extend by duration:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[15, 30, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setAdditionalMinutes(mins)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors ${
                      additionalMinutes === mins
                        ? "bg-indigo-600 text-white border-indigo-500"
                        : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    +{mins} mins
                  </button>
                ))}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Current End:</span>
                <span className="font-mono">{format(currentEndDate, "h:mm a")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-indigo-400 font-medium">Requested End:</span>
                <span className="font-mono text-indigo-300 font-bold">{format(newEndDate, "h:mm a")}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>Send Request</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

