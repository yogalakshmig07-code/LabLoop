"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  X,
  Camera,
  Check,
  AlertCircle,
  ArrowRight,
  Clock,
  User,
  ShieldAlert,
  ArrowLeftRight,
} from "lucide-react";
import { submitReturnReportAction } from "@/actions/handovers";
import { useToast } from "@/components/ui/toast";
import { CATEGORY_CHECKLISTS, compareConditionReports, ConditionComparisonResult } from "@/lib/checklists";
import { ConditionGrade, ResourceCategory } from "@/types/db";
import { format, formatDistanceStrict } from "date-fns";

export interface ConditionReportData {
  id: string;
  kind: "checkout" | "return";
  grade: ConditionGrade;
  notes: string | null;
  checklist: Record<string, boolean>;
  photo_paths: string[];
  photoUrls?: Record<string, string>;
  created_at: string;
}

export interface ReturnBookingData {
  id: string;
  status: string;
  start_at: string;
  end_at: string;
  checked_out_at?: string | null;
  returned_at?: string | null;
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
  };
}

interface ReturnFormProps {
  booking: ReturnBookingData;
  checkoutReport?: ConditionReportData | null;
  existingReturnReport?: ConditionReportData | null;
}

export function ReturnForm({
  booking,
  checkoutReport,
  existingReturnReport,
}: ReturnFormProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [isPending, startTransition] = useTransition();

  const [returnReport, setReturnReport] = useState<ConditionReportData | null>(
    existingReturnReport || null
  );

  const defaultItems =
    CATEGORY_CHECKLISTS[booking.resource.category] || CATEGORY_CHECKLISTS.equipment;

  // Initialize return form state
  const [grade, setGrade] = useState<ConditionGrade>(
    checkoutReport ? checkoutReport.grade : "good"
  );

  const [checklist, setChecklist] = useState<Record<string, boolean>>(() => {
    if (checkoutReport && checkoutReport.checklist) {
      return { ...checkoutReport.checklist };
    }
    const initial: Record<string, boolean> = {};
    defaultItems.forEach((item) => {
      initial[item] = true;
    });
    return initial;
  });

  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  const now = new Date();
  const endAt = new Date(booking.end_at);
  const isLate = now > endAt;
  const lateDistance = isLate ? formatDistanceStrict(now, endAt) : null;

  const toggleChecklistItem = (item: string) => {
    setChecklist((prev) => ({
      ...prev,
      [item]: !prev[item],
    }));
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);

    if (photos.length + newFiles.length > 4) {
      toastError("You can upload a maximum of 4 condition inspection photos.");
      return;
    }

    const validFiles: File[] = [];
    const newPreviews: string[] = [];

    for (const file of newFiles) {
      if (file.size > 5 * 1024 * 1024) {
        toastError(`Photo "${file.name}" exceeds 5MB size limit.`);
        continue;
      }
      validFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }

    setPhotos((prev) => [...prev, ...validFiles]);
    setPhotoPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      const formData = new FormData();
      formData.append("booking_id", booking.id);
      formData.append("grade", grade);
      formData.append("notes", notes.trim());
      formData.append("checklist", JSON.stringify(checklist));

      photos.forEach((photo) => {
        formData.append("photos", photo);
      });

      const res = await submitReturnReportAction(formData);
      if (res.ok) {
        success("Return inspection recorded successfully! Gear checked in.");
        // Set local return report to display before-and-after comparison
        setReturnReport({
          id: res.data.reportId,
          kind: "return",
          grade,
          notes: notes.trim() || null,
          checklist,
          photo_paths: [],
          created_at: new Date().toISOString(),
        });
        router.refresh();
      } else {
        toastError(res.error || "Failed to process equipment return.");
      }
    });
  };

  const grades: { value: ConditionGrade; label: string; desc: string }[] = [
    { value: "excellent", label: "Excellent", desc: "Clean, perfect working order" },
    { value: "good", label: "Good", desc: "Expected normal wear, intact" },
    { value: "fair", label: "Fair", desc: "Noticeable wear, functional" },
    { value: "damaged", label: "Damaged", desc: "Defects, cracked, or broken" },
  ];

  // If already returned or just submitted, show BEFORE vs AFTER comparison
  if (returnReport) {
    const comparison: ConditionComparisonResult = compareConditionReports(
      checkoutReport,
      returnReport,
      booking.resource.category
    );

    return (
      <div className="space-y-6">
        {/* Condition Change / Degraded Alert Call To Action */}
        {comparison.isConditionDegraded && (
          <div className="p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-200 shadow-md space-y-3">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold text-white">
                  Condition Regressed: Incident Report Recommended
                </h3>
                <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">
                  The returned equipment was graded worse than at check-out or checklist items failed inspection.
                  Log an official incident report to document damages, request repair, or apply safety review.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Link
                href={`/bookings/${booking.id}/incident`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-sm transition-all"
              >
                <span>Report Incident for this Booking</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Comparison Header Card */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2 text-indigo-400">
              <ArrowLeftRight className="w-5 h-5" />
              <h2 className="text-base font-bold text-white">
                Inspection Comparison: Check-Out vs Return
              </h2>
            </div>
            <span className="text-xs uppercase font-mono px-2.5 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-slate-700 font-semibold">
              Status: Returned
            </span>
          </div>

          {/* Grade Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Check-Out Baseline Grade
              </span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-white uppercase">
                  {checkoutReport?.grade || "N/A"}
                </span>
                <span className="text-xs text-slate-500">
                  {checkoutReport ? format(new Date(checkoutReport.created_at), "h:mm a, MMM d") : ""}
                </span>
              </div>
            </div>

            <div
              className={`p-4 rounded-xl border space-y-1.5 ${
                comparison.gradeWorse
                  ? "bg-rose-950/20 border-rose-500/40"
                  : "bg-slate-950/60 border-slate-800"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Return Inspection Grade
                </span>
                {comparison.gradeWorse && (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">
                    Worse Grade
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-white uppercase">
                  {returnReport.grade}
                </span>
                <span className="text-xs text-slate-500">
                  {format(new Date(returnReport.created_at), "h:mm a, MMM d")}
                </span>
              </div>
            </div>
          </div>

          {/* Checklist Comparison Table */}
          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Checklist Item Status Side-by-Side:
            </h3>

            <div className="divide-y divide-slate-800/80 rounded-xl bg-slate-950/60 border border-slate-800 overflow-hidden">
              <div className="grid grid-cols-12 p-3 text-[11px] font-semibold text-slate-400 uppercase bg-slate-900/80 border-b border-slate-800">
                <div className="col-span-6 sm:col-span-7">Item Description</div>
                <div className="col-span-3 sm:col-span-2 text-center">Check-Out</div>
                <div className="col-span-3 sm:col-span-3 text-center">Return</div>
              </div>

              {comparison.items.map((row) => (
                <div
                  key={row.item}
                  className={`grid grid-cols-12 p-3 text-xs items-center transition-colors ${
                    row.regressed ? "bg-rose-950/20 font-semibold" : "hover:bg-slate-800/20"
                  }`}
                >
                  <div className="col-span-6 sm:col-span-7 text-slate-200 flex items-center gap-2">
                    {row.regressed && (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    )}
                    <span>{row.item}</span>
                  </div>

                  <div className="col-span-3 sm:col-span-2 text-center">
                    {row.checkoutPassed ? (
                      <span className="text-emerald-400 font-mono text-[11px]">Pass</span>
                    ) : (
                      <span className="text-rose-400 font-mono text-[11px]">Fail</span>
                    )}
                  </div>

                  <div className="col-span-3 sm:col-span-3 text-center flex items-center justify-center gap-1.5">
                    {row.returnPassed ? (
                      <span className="text-emerald-400 font-mono text-[11px]">Pass</span>
                    ) : (
                      <span className="text-rose-400 font-bold font-mono text-[11px]">
                        Failed {row.regressed ? "(Regressed)" : ""}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes Side by Side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-1">
              <span className="text-xs font-semibold text-slate-400">Check-Out Notes:</span>
              <p className="text-xs text-slate-300 italic">
                {checkoutReport?.notes || "No notes recorded at check-out."}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-1">
              <span className="text-xs font-semibold text-slate-400">Return Notes:</span>
              <p className="text-xs text-slate-300 italic">
                {returnReport.notes || "No notes recorded at return."}
              </p>
            </div>
          </div>

          {/* Photos Side by Side (if photos exist) */}
          {(checkoutReport?.photoUrls || returnReport.photoUrls) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {checkoutReport?.photoUrls && Object.keys(checkoutReport.photoUrls).length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-400">Check-Out Photos:</span>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.values(checkoutReport.photoUrls).map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="aspect-square rounded-lg overflow-hidden border border-slate-700 bg-slate-950">
                        <img src={url} alt={`Checkout photo ${i + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {returnReport.photoUrls && Object.keys(returnReport.photoUrls).length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-400">Return Photos:</span>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.values(returnReport.photoUrls).map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="aspect-square rounded-lg overflow-hidden border border-slate-700 bg-slate-950">
                        <img src={url} alt={`Return photo ${i + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-2">
          <Link
            href="/handovers"
            className="text-xs text-slate-400 hover:text-white"
          >
            ← Back to Handover Desk
          </Link>
          <Link
            href={`/bookings/${booking.id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
          >
            <span>View Full Booking Details</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Otherwise, render the active Return Inspection Form
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Late Return Alert if applicable */}
      {isLate && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Late Return Alert</span>
            This session was scheduled to end at {format(endAt, "h:mm a")} and is currently overdue by{" "}
            <strong>{lateDistance}</strong>. This delay will be recorded in audit logs.
          </div>
        </div>
      )}

      {/* Baseline Context Card */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-indigo-300">
              {booking.resource.category}
            </span>
            <span className="font-bold text-white text-sm">{booking.resource.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Initial Check-out Grade:</span>
            <span className="font-bold text-emerald-400 uppercase">
              {checkoutReport?.grade || "Excellent"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-300">
          <User className="w-3.5 h-3.5 text-slate-500" />
          <span>Returning Student: </span>
          <strong className="text-white">{booking.user.full_name || booking.user.email}</strong>
        </div>
      </div>

      {/* 1. Return Condition Grade */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div>
          <label className="block text-sm font-bold text-white mb-1">
            Return Inspection Grade <span className="text-rose-400">*</span>
          </label>
          <p className="text-xs text-slate-400">
            Assess the condition of the equipment upon completion of the user&apos;s session.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {grades.map((g) => {
            const isSelected = grade === g.value;
            return (
              <button
                key={g.value}
                type="button"
                onClick={() => setGrade(g.value)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "bg-indigo-600/20 border-indigo-500 ring-2 ring-indigo-500/30"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    {g.label}
                  </span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
                </div>
                <p className="text-[11px] text-slate-400">{g.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Checklist Verification */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div>
          <label className="block text-sm font-bold text-white mb-1">
            Return Checklist ({booking.resource.category.toUpperCase()})
          </label>
          <p className="text-xs text-slate-400">
            Check off verified items. Uncheck any items that were returned damaged, missing, or inoperable.
          </p>
        </div>

        <div className="divide-y divide-slate-800/80 rounded-xl bg-slate-950/60 border border-slate-800 overflow-hidden">
          {defaultItems.map((item) => {
            const passed = checklist[item] !== false;
            return (
              <div
                key={item}
                onClick={() => toggleChecklistItem(item)}
                className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/30 transition-colors"
              >
                <span className="text-xs font-medium text-slate-200">{item}</span>

                <button
                  type="button"
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                    passed
                      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                      : "bg-rose-500/10 text-rose-300 border-rose-500/30"
                  }`}
                >
                  {passed ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Intact / Passed</span>
                    </>
                  ) : (
                    <>
                      <X className="w-3.5 h-3.5 text-rose-400" />
                      <span>Defect / Regressed</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Photos Upload (1–4 Photos) */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-bold text-white mb-1">
              Return Inspection Photos (1–4 Photos)
            </label>
            <p className="text-xs text-slate-400">
              Capture final workbench condition and document any wear or issues noticed.
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono">{photos.length}/4 photos</span>
        </div>

        {photoPreviews.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {photoPreviews.map((url, idx) => (
              <div
                key={idx}
                className="relative aspect-square rounded-xl overflow-hidden border border-slate-700 bg-slate-950 group"
              >
                <img
                  src={url}
                  alt={`Return inspection photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-900/80 text-rose-400 hover:text-white hover:bg-rose-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {photos.length < 4 && (
          <label className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 transition-colors rounded-xl p-5 text-center bg-slate-950/40 cursor-pointer block">
            <Camera className="w-6 h-6 text-indigo-400 mx-auto mb-1.5" />
            <span className="text-xs font-semibold text-indigo-400 hover:underline">
              Add Return Photo
            </span>
            <p className="text-[11px] text-slate-500 mt-0.5">JPEG, PNG, or WEBP up to 5MB</p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoSelect}
              multiple
              className="hidden"
            />
          </label>
        )}
      </div>

      {/* 4. Notes */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
        <label className="block text-sm font-bold text-white">
          Return Inspection Notes (Optional)
        </label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Tools wiped down; returned with all cables organized in bin."
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Recording Return Inspection...</span>
            </>
          ) : (
            <>
              <RotateCcw className="w-4 h-4" />
              <span>Complete Return &amp; Inspect</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}

