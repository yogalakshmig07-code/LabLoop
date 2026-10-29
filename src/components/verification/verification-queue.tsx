"use client";

import React, { useState, useTransition } from "react";
import {
  Award,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Loader2,
  FileText,
  User,
  Building,
  Mail,
  ShieldCheck,
  Check,
  X,
} from "lucide-react";
import { PendingCredentialItem } from "@/lib/credentials";
import {
  verifyCredentialAction,
  rejectCredentialAction,
  getCredentialViewUrlAction,
} from "@/actions/credentials";
import { useToast } from "@/components/ui/toast";
import { format } from "date-fns";

interface VerificationQueueProps {
  initialItems: PendingCredentialItem[];
  viewerRole: string;
}

export function VerificationQueue({ initialItems, viewerRole }: VerificationQueueProps) {
  const [items, setItems] = useState<PendingCredentialItem[]>(initialItems);
  const [activeModal, setActiveModal] = useState<{
    type: "verify" | "reject";
    item: PendingCredentialItem;
  } | null>(null);

  // Form states for modal
  const [expiryDate, setExpiryDate] = useState("");
  const [verifyNote, setVerifyNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const [openingFileId, setOpeningFileId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { success, error: toastError } = useToast();

  const handleOpenDoc = (id: string) => {
    setOpeningFileId(id);
    startTransition(async () => {
      const res = await getCredentialViewUrlAction(id);
      if (res.ok) {
        if (res.data) window.open(res.data, "_blank", "noopener,noreferrer");
      } else {
        toastError(res.error || "Unable to open document proof.");
      }
      setOpeningFileId(null);
    });
  };

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModal || activeModal.type !== "verify") return;

    const { item } = activeModal;
    startTransition(async () => {
      const res = await verifyCredentialAction(item.id, expiryDate || undefined, verifyNote || undefined);
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        success(`"${item.credential_type}" for ${item.user?.full_name || "student"} verified successfully.`);
        setActiveModal(null);
        setExpiryDate("");
        setVerifyNote("");
      } else {
        toastError(res.error || "Verification failed.");
      }
    });
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModal || activeModal.type !== "reject") return;

    const { item } = activeModal;
    if (!rejectReason.trim()) {
      toastError("Please provide a reason for rejecting this credential.");
      return;
    }

    startTransition(async () => {
      const res = await rejectCredentialAction(item.id, rejectReason.trim());
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        success(`Submission rejected. Student notified.`);
        setActiveModal(null);
        setRejectReason("");
      } else {
        toastError(res.error || "Rejection failed.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Metric Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
            {items.length}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Pending Verification Submissions</h2>
            <p className="text-xs text-slate-400">
              {viewerRole === "admin"
                ? "Global review queue (all departments)"
                : "Certifications required for your managed campus resources"}
            </p>
          </div>
        </div>
      </div>

      {/* Verification Queue List */}
      {items.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">Verification Queue Clear</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            There are no pending safety certificates or training inductions awaiting review for your managed resources.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
          {items.map((item) => {
            const isOpening = openingFileId === item.id && isPending;

            return (
              <div
                key={item.id}
                className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors"
              >
                {/* User & Credential Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-bold text-white tracking-wide">
                      {item.credential_type}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      <Clock className="w-3 h-3" />
                      Pending Review
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-300 flex-wrap">
                    <div className="flex items-center gap-1.5 font-medium text-white">
                      <User className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{item.user?.full_name || "Unknown Student"}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                      <span>{item.user?.email || "No email"}</span>
                    </div>

                    {item.user?.department && (
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Building className="w-3.5 h-3.5 text-slate-500" />
                        <span>{item.user.department}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Submitted {format(new Date(item.created_at), "MMM d, yyyy h:mm a")}</span>
                    </div>
                  </div>

                  {item.expires_at && (
                    <p className="text-xs text-slate-400">
                      <span className="text-slate-500">Proposed Expiry: </span>
                      {item.expires_at}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                  {item.file_path && (
                    <button
                      type="button"
                      disabled={isOpening}
                      onClick={() => handleOpenDoc(item.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition-colors disabled:opacity-50"
                    >
                      {isOpening ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-indigo-400" />
                      )}
                      <span>View Proof</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal({ type: "verify", item });
                      setExpiryDate(item.expires_at || "");
                      setVerifyNote("");
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Verify</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal({ type: "reject", item });
                      setRejectReason("");
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Verify Confirmation Modal */}
      {activeModal && activeModal.type === "verify" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">Verify Credential</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Approve <span className="font-semibold text-white">{activeModal.item.credential_type}</span> for{" "}
              <span className="font-semibold text-white">
                {activeModal.item.user?.full_name || activeModal.item.user?.email}
              </span>
              .
            </p>

            <form onSubmit={handleVerifySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Expiration Date (Optional)
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[11px] text-slate-500">
                  Leave empty if this training does not expire.
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Note to Student (Optional)
                </label>
                <input
                  type="text"
                  value={verifyNote}
                  onChange={(e) => setVerifyNote(e.target.value)}
                  placeholder="e.g. Valid for all Tier 2 Makerspace tooling"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Grant Verification</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Confirmation Modal */}
      {activeModal && activeModal.type === "reject" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 text-rose-400">
                <AlertCircle className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">Reject Credential Submission</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Please specify why this proof document was declined. The student will be notified and asked to resubmit.
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Reason for Rejection <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Certificate image was illegible or missing official instructor stamp."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Rejection</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
