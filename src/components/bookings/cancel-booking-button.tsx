"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { XCircle, AlertTriangle, Loader2, X } from "lucide-react";
import { cancelBookingAction } from "@/actions/cancel-booking";
import { useToast } from "@/components/ui/toast";

interface CancelBookingButtonProps {
  bookingId: string;
  isApproved?: boolean;
  startAt?: string;
  buttonClassName?: string;
}

export function CancelBookingButton({
  bookingId,
  isApproved = false,
  startAt,
  buttonClassName,
}: CancelBookingButtonProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  // Check if late cancellation (< 2h before start)
  let isLate = false;
  if (startAt) {
    const hours = (new Date(startAt).getTime() - Date.now()) / (1000 * 60 * 60);
    isLate = hours < 2;
  }

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (isApproved && !reason.trim()) {
      toastError("A reason is required to cancel an approved reservation.");
      return;
    }

    startTransition(async () => {
      const res = await cancelBookingAction(bookingId, reason.trim());
      if (res.ok) {
        success("Reservation cancelled successfully.");
        setIsOpen(false);
        router.refresh();
      } else {
        toastError(res.error || "Failed to cancel reservation.");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          buttonClassName ||
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-300 border border-rose-500/20 text-xs font-semibold transition-all"
        }
      >
        <XCircle className="w-3.5 h-3.5" />
        <span>Cancel Reservation</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">Cancel Reservation</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isApproved && isLate && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Notice (Late Cancellation): </span>
                  This session starts in less than 2 hours. The slot will be automatically released to the top waitlisted student.
                </div>
              </div>
            )}

            <form onSubmit={handleConfirm} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Reason for cancellation {isApproved && <span className="text-rose-400">*</span>}
                </label>
                <textarea
                  rows={3}
                  required={isApproved}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    isApproved
                      ? "e.g. Experiment rescheduled or completed ahead of time"
                      : "Optional note for facility records"
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800"
                >
                  Keep Reservation
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Cancellation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

