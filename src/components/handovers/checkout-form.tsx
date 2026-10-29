"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Camera,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  X,
  Upload,
  Clock,
  User,
  MapPin,
  Check,
} from "lucide-react";
import { submitCheckoutReportAction } from "@/actions/handovers";
import { useToast } from "@/components/ui/toast";
import { CATEGORY_CHECKLISTS } from "@/lib/checklists";
import { ConditionGrade, ResourceCategory } from "@/types/db";
import { format } from "date-fns";

export interface CheckoutBookingData {
  id: string;
  start_at: string;
  end_at: string;
  purpose: string | null;
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

interface CheckoutFormProps {
  booking: CheckoutBookingData;
  isWithinGraceWindow: boolean;
  earliestTimeFormatted: string;
  endTimeFormatted: string;
}

export function CheckoutForm({
  booking,
  isWithinGraceWindow,
  earliestTimeFormatted,
  endTimeFormatted,
}: CheckoutFormProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [isPending, startTransition] = useTransition();

  const [grade, setGrade] = useState<ConditionGrade>("excellent");
  const defaultItems = CATEGORY_CHECKLISTS[booking.resource.category] || CATEGORY_CHECKLISTS.equipment;

  // Initialize checklist items as true (passed)
  const [checklist, setChecklist] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    defaultItems.forEach((item) => {
      initial[item] = true;
    });
    return initial;
  });

  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

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
        toastError(`Photo "${file.name}" exceeds the 5MB size limit.`);
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
    if (!isWithinGraceWindow) {
      toastError("Check-out cannot be completed outside the permitted 30-minute grace window.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("booking_id", booking.id);
      formData.append("grade", grade);
      formData.append("notes", notes.trim());
      formData.append("checklist", JSON.stringify(checklist));

      photos.forEach((photo) => {
        formData.append("photos", photo);
      });

      const res = await submitCheckoutReportAction(formData);
      if (res.ok) {
        success("Check-out completed! Resource is now marked active in session.");
        router.push(`/bookings/${booking.id}`);
      } else {
        toastError(res.error || "Failed to complete check-out.");
      }
    });
  };

  const grades: { value: ConditionGrade; label: string; desc: string; color: string }[] = [
    { value: "excellent", label: "Excellent", desc: "Flawless, clean, like new", color: "emerald" },
    { value: "good", label: "Good", desc: "Minor normal cosmetic wear", color: "indigo" },
    { value: "fair", label: "Fair", desc: "Visible wear, fully functional", color: "amber" },
    { value: "damaged", label: "Damaged", desc: "Defects or physical issues", color: "rose" },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Grace Window Warning if blocked */}
      {!isWithinGraceWindow && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Check-out Window Notice</span>
            Check-out is restricted to within 30 minutes before session start and before the end time.
            Permitted window: <strong className="text-white">{earliestTimeFormatted}</strong> to{" "}
            <strong className="text-white">{endTimeFormatted}</strong>.
          </div>
        </div>
      )}

      {/* Recipient & Session Context Card */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-indigo-300">
              {booking.resource.category}
            </span>
            <span className="font-bold text-white text-sm">{booking.resource.name}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              {format(new Date(booking.start_at), "h:mm a")} - {format(new Date(booking.end_at), "h:mm a")}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-300">
          <User className="w-3.5 h-3.5 text-slate-500" />
          <span>Present Borrower: </span>
          <strong className="text-white">{booking.user.full_name || booking.user.email}</strong>
          {booking.user.department && <span className="text-slate-500">({booking.user.department})</span>}
        </div>
      </div>

      {/* 1. Condition Grade Radio Cards */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div>
          <label className="block text-sm font-bold text-white mb-1">
            Initial Condition Grade <span className="text-rose-400">*</span>
          </label>
          <p className="text-xs text-slate-400">
            Rate the physical and operational condition of the equipment at checkout.
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

      {/* 2. Category Checklist */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div>
          <label className="block text-sm font-bold text-white mb-1">
            Physical Inspection Checklist ({booking.resource.category.toUpperCase()})
          </label>
          <p className="text-xs text-slate-400">
            Verify each functional item with the student present prior to handing over custody.
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
                      <span>Passed</span>
                    </>
                  ) : (
                    <>
                      <X className="w-3.5 h-3.5 text-rose-400" />
                      <span>Issue / Missing</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Photos Upload (1 to 4 photos) */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-bold text-white mb-1">
              Condition Photos (1–4 Photos)
            </label>
            <p className="text-xs text-slate-400">
              Capture serial number, current workbench state, and any existing cosmetic marks.
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono">{photos.length}/4 photos</span>
        </div>

        {/* Photo Previews */}
        {photoPreviews.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {photoPreviews.map((url, idx) => (
              <div
                key={idx}
                className="relative aspect-square rounded-xl overflow-hidden border border-slate-700 bg-slate-950 group"
              >
                <img
                  src={url}
                  alt={`Inspection photo ${idx + 1}`}
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
              Add Inspection Photo
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
          Inspection Notes &amp; Observations (Optional)
        </label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Minor sticker residue on left casing; extra power cord provided."
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Submit Button */}
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
          disabled={isPending || !isWithinGraceWindow}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving Check-out Inspection...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              <span>Confirm &amp; Check Out Equipment</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}

