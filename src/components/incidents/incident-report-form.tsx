"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  X,
  Loader2,
  ShieldAlert,
  Info,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { reportIncidentAction } from "@/actions/incidents";
import { useToast } from "@/components/ui/toast";
import { IncidentType } from "@/types/db";

interface IncidentReportFormProps {
  bookingId?: string | null;
  resourceId: string;
  resourceName: string;
  resourceCategory?: string;
  borrowerName?: string | null;
}

const INCIDENT_TYPES: { value: IncidentType; label: string; desc: string }[] = [
  { value: "damage", label: "Physical Damage / Defect", desc: "Hardware breakage, scratch, malfunction, missing parts" },
  { value: "delay", label: "Return Delay / Late Handover", desc: "Late return impacting following reservations" },
  { value: "conflict", label: "Access / Conflict Issue", desc: "Facility locked, unauthorized occupancy, double booking" },
  { value: "safety", label: "Safety / Environmental Hazard", desc: "Chemical spill, overheating, electrical or safety hazard" },
  { value: "other", label: "Other Operational Issue", desc: "Any other operational irregularity or rule breach" },
];

export function IncidentReportForm({
  bookingId,
  resourceId,
  resourceName,
  resourceCategory,
  borrowerName,
}: IncidentReportFormProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [isPending, startTransition] = useTransition();

  const [incidentType, setIncidentType] = useState<IncidentType>("damage");
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    if (photos.length + files.length > 4) {
      toastError("Maximum 4 photos allowed per incident report.");
      return;
    }

    const newPhotos = [...photos, ...files].slice(0, 4);
    setPhotos(newPhotos);

    const newPreviews = newPhotos.map((f) => URL.createObjectURL(f));
    setPreviews(newPreviews);
  };

  const removePhoto = (index: number) => {
    const updatedPhotos = photos.filter((_, i) => i !== index);
    setPhotos(updatedPhotos);

    URL.revokeObjectURL(previews[index]);
    setPreviews(previews.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (description.trim().length < 10) {
      setErrorMessage("Please enter a substantive description of what occurred (at least 10 characters).");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      if (bookingId) formData.append("booking_id", bookingId);
      formData.append("resource_id", resourceId);
      formData.append("incident_type", incidentType);
      formData.append("severity", severity);
      formData.append("description", description.trim());

      photos.forEach((photo) => {
        formData.append("photos", photo);
      });

      const res = await reportIncidentAction(formData);

      if (res.ok) {
        success("Incident report filed successfully.");
        router.push(`/incidents/${res.data.incidentId}`);
      } else {
        setErrorMessage(res.error || "Failed to submit incident report.");
        toastError(res.error || "Failed to submit incident report.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Target Resource & Context Banner */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Associated Resource &amp; Reservation
        </span>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-white">{resourceName}</h3>
            {resourceCategory && (
              <span className="text-xs text-indigo-400 capitalize font-medium">
                {resourceCategory} Category
              </span>
            )}
          </div>
          {bookingId && (
            <div className="text-right">
              <span className="text-xs font-mono text-slate-400">
                Booking #{bookingId.slice(0, 8)}
              </span>
              {borrowerName && (
                <p className="text-xs text-slate-400">
                  Borrower: <span className="text-slate-200 font-medium">{borrowerName}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Incident Type Selector */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
          Incident Classification <span className="text-rose-400">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {INCIDENT_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setIncidentType(t.value)}
              className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                incidentType === t.value
                  ? "bg-indigo-600/15 border-indigo-500 text-white shadow-sm ring-1 ring-indigo-500/30"
                  : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{t.label}</span>
                {incidentType === t.value && (
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Severity Level */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
          Estimated Severity <span className="text-rose-400">*</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: "low", label: "Low", desc: "Minor cosmetic issue; usable" },
            { value: "medium", label: "Medium", desc: "Requires maintenance/delay" },
            { value: "high", label: "High", desc: "Safety hazard or unusable" },
          ].map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSeverity(s.value as any)}
              className={`p-3 rounded-xl border text-center transition-all ${
                severity === s.value
                  ? s.value === "high"
                    ? "bg-rose-500/20 border-rose-500 text-rose-300 font-bold"
                    : s.value === "medium"
                    ? "bg-amber-500/20 border-amber-500 text-amber-300 font-bold"
                    : "bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="text-xs uppercase">{s.label}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{s.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Factual Description <span className="text-rose-400">*</span>
          </label>
          <span className="text-[11px] text-slate-500">Min 10 characters</span>
        </div>
        <textarea
          rows={4}
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what occurred factually: observed defects, symptoms, timeline of events, or safety concerns..."
          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all leading-relaxed resize-y"
        />
      </div>

      {/* Photo Uploads */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
          Photographic Evidence (Optional, max 4)
        </label>
        <p className="text-xs text-slate-400">
          Attach clear photos of damages, warning lights, or relevant conditions.
        </p>

        <div className="flex flex-wrap gap-3 pt-1">
          {previews.map((src, idx) => (
            <div
              key={idx}
              className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-700 group bg-slate-900"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="Evidence preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(idx)}
                className="absolute top-1 right-1 p-1 rounded-full bg-slate-950/80 text-white hover:bg-rose-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {photos.length < 4 && (
            <label className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-950/60 hover:bg-slate-900 flex flex-col items-center justify-center cursor-pointer transition-all text-slate-400 hover:text-indigo-400">
              <Camera className="w-6 h-6 mb-1" />
              <span className="text-[10px] font-semibold">Add Photo</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={isPending || description.trim().length < 10}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg shadow-rose-900/30 transition-all"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Filing Incident Report...</span>
            </>
          ) : (
            <>
              <ShieldAlert className="w-4 h-4" />
              <span>Submit Incident Report</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
