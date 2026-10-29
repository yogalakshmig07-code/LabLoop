"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Save,
  Plus,
  Trash2,
  ChevronLeft,
  Upload,
  AlertCircle,
  CheckCircle2,
  Clock,
  Shield,
  Layers,
} from "lucide-react";
import { ResourceUpsertInput } from "@/lib/validations";
import { saveResourceAction } from "@/actions/resources";
import { createClient } from "@/lib/supabase/browser";
import { useToast } from "@/components/ui/toast";

const DAYS_OF_WEEK = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

interface ManagerOption {
  id: string;
  name: string;
  email: string;
}

interface ResourceFormProps {
  initialData?: ResourceUpsertInput;
  availableManagers: ManagerOption[];
  isOwnerVerified: boolean;
  isAdmin: boolean;
}

export function ResourceForm({
  initialData,
  availableManagers,
  isOwnerVerified,
  isAdmin,
}: ResourceFormProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [isPending, startTransition] = useTransition();

  const isEditing = Boolean(initialData?.id);

  // Form State
  const [name, setName] = useState(initialData?.name || "");
  const [category, setCategory] = useState<string>(initialData?.category || "equipment");
  const [location, setLocation] = useState(initialData?.location || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [imagePath, setImagePath] = useState(initialData?.image_path || "");
  const [isActive, setIsActive] = useState(initialData ? initialData.is_active : true);
  const [requiresSupervision, setRequiresSupervision] = useState(
    initialData ? initialData.requires_supervision : false
  );
  const [maxDurationHours, setMaxDurationHours] = useState<number>(
    initialData?.max_duration_hours || 4
  );
  const [bufferMinutes, setBufferMinutes] = useState<number>(
    initialData?.buffer_minutes || 15
  );
  const [usageRules, setUsageRules] = useState(initialData?.usage_rules || "");
  const [depositNote, setDepositNote] = useState(initialData?.deposit_note || "");

  // Repeatable Requirements
  const [requirements, setRequirements] = useState<
    Array<{ credential_type: string; description?: string | null }>
  >(
    initialData?.requirements || [
      { credential_type: "Lab Safety Induction", description: "General safety qualification" },
    ]
  );

  // Repeatable Availability Windows
  const [availabilityWindows, setAvailabilityWindows] = useState<
    Array<{ day_of_week: number; start_time: string; end_time: string }>
  >(
    initialData?.availability_windows || [
      { day_of_week: 1, start_time: "09:00", end_time: "17:00" },
      { day_of_week: 2, start_time: "09:00", end_time: "17:00" },
      { day_of_week: 3, start_time: "09:00", end_time: "17:00" },
      { day_of_week: 4, start_time: "09:00", end_time: "17:00" },
      { day_of_week: 5, start_time: "09:00", end_time: "17:00" },
    ]
  );

  // Selected Managers
  const [selectedManagerIds, setSelectedManagerIds] = useState<string[]>(
    initialData?.manager_ids || []
  );

  const [formError, setFormError] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Requirements handlers
  const addRequirement = () => {
    setRequirements((prev) => [...prev, { credential_type: "", description: "" }]);
  };

  const removeRequirement = (idx: number) => {
    setRequirements((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateRequirement = (idx: number, field: "credential_type" | "description", val: string) => {
    setRequirements((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item))
    );
  };

  // Windows handlers
  const addWindow = () => {
    setAvailabilityWindows((prev) => [
      ...prev,
      { day_of_week: 1, start_time: "09:00", end_time: "17:00" },
    ]);
  };

  const removeWindow = (idx: number) => {
    setAvailabilityWindows((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateWindow = (
    idx: number,
    field: "day_of_week" | "start_time" | "end_time",
    val: any
  ) => {
    setAvailabilityWindows((prev) =>
      prev.map((w, i) => (i === idx ? { ...w, [field]: val } : w))
    );
  };

  // Manager checkbox toggle
  const toggleManager = (id: string) => {
    setSelectedManagerIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  // Image Upload handler to Supabase storage "resource-images"
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingImage(true);
      const supabase = createClient();
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2, 10)}_${Date.now()}.${fileExt}`;
      const filePath = `resources/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("resource-images")
        .upload(filePath, file);

      if (uploadError) {
        toastError(`Image upload failed: ${uploadError.message}`);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("resource-images")
        .getPublicUrl(filePath);

      setImagePath(publicUrlData.publicUrl);
      success("Image uploaded successfully!");
    } catch (err: any) {
      toastError(`Upload error: ${err.message}`);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!isAdmin && !isOwnerVerified) {
      setFormError("Only verified faculty owners or administrators can create or publish resources.");
      return;
    }

    const payload: ResourceUpsertInput = {
      id: initialData?.id,
      name,
      category: category as any,
      location,
      description: description || null,
      image_path: imagePath || null,
      is_active: isActive,
      requires_supervision: requiresSupervision,
      max_duration_hours: Number(maxDurationHours),
      buffer_minutes: Number(bufferMinutes),
      usage_rules: usageRules || null,
      deposit_note: depositNote || null,
      requirements: requirements.filter((r) => r.credential_type.trim().length > 0),
      availability_windows: availabilityWindows,
      manager_ids: selectedManagerIds,
    };

    startTransition(async () => {
      const res = await saveResourceAction(payload);
      if (!res.ok) {
        setFormError(res.error);
        toastError(res.error);
      } else {
        success(isEditing ? "Resource updated successfully!" : "Resource created successfully!");
        router.push("/my-resources");
        router.refresh();
      }
    });
  };

  const canSave = isAdmin || isOwnerVerified;

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Back button */}
      <div>
        <Link
          href="/my-resources"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors focus:outline-none focus:underline"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to My Resources</span>
        </Link>
      </div>

      {/* Header */}
      <div className="border-b border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Layers className="w-7 h-7 text-indigo-400" />
            <span>{isEditing ? `Edit Resource: ${initialData?.name}` : "Create New Resource"}</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure laboratory facilities, safety certification requirements, and manager delegations.
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending || !canSave}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:cursor-not-allowed text-white font-medium text-xs shadow-lg shadow-indigo-600/30 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0 self-start sm:self-center"
        >
          {isPending ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>{isEditing ? "Save Changes" : "Create Resource"}</span>
            </>
          )}
        </button>
      </div>

      {/* Unverified Owner Banner */}
      {!canSave && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-semibold">Account Pending Verification</strong>
            <span>
              Your faculty owner profile has not been verified yet by campus administrators. You can
              draft the details below, but cannot publish resources until verified.
            </span>
          </div>
        </div>
      )}

      {formError && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      {/* 1. Core Information */}
      <section className="p-6 sm:p-7 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider text-slate-400">
          Core Resource Information
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Resource Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 3D Printer (Prusa MK4) or RF Electronics Bench"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 capitalize"
            >
              <option value="equipment">Equipment</option>
              <option value="lab">Lab Bench</option>
              <option value="computing">Computing</option>
              <option value="media">Media &amp; Video</option>
              <option value="room">Room &amp; Hall</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Campus Location *
            </label>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. FabLab Room 102, Innovation Wing"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Description &amp; Specifications
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe specifications, capabilities, and suitable coursework/research workloads..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Resource Photo
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                type="text"
                value={imagePath}
                onChange={(e) => setImagePath(e.target.value)}
                placeholder="Image URL or upload a file"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
              <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer shrink-0 transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>{isUploadingImage ? "Uploading..." : "Upload Photo"}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isUploadingImage}
                  className="hidden"
                />
              </label>
            </div>
            {imagePath && (
              <div className="mt-2 relative w-32 h-20 rounded-lg overflow-hidden border border-slate-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePath} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. Operational Parameters & Rules */}
      <section className="p-6 sm:p-7 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider text-slate-400">
          Booking Constraints &amp; Rules
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Max Session Duration (Hours) *
            </label>
            <input
              type="number"
              min={1}
              max={24}
              required
              value={maxDurationHours}
              onChange={(e) => setMaxDurationHours(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Turnaround Buffer (Minutes) *
            </label>
            <input
              type="number"
              min={0}
              max={120}
              step={5}
              required
              value={bufferMinutes}
              onChange={(e) => setBufferMinutes(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="sm:col-span-2 flex flex-wrap gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-700 focus:ring-indigo-500 focus:ring-offset-slate-900"
              />
              <span className="text-xs font-semibold text-white">Active in Catalog</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={requiresSupervision}
                onChange={(e) => setRequiresSupervision(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-700 focus:ring-indigo-500 focus:ring-offset-slate-900"
              />
              <span className="text-xs font-semibold text-amber-300">
                Requires Faculty/Tech Supervision during use
              </span>
            </label>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Mandatory Usage Rules
            </label>
            <textarea
              rows={2}
              value={usageRules}
              onChange={(e) => setUsageRules(e.target.value)}
              placeholder="e.g. Ground ESD strap before touching RF probes; wear laser safety glasses..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Deposit &amp; Student ID Note (Optional)
            </label>
            <input
              type="text"
              value={depositNote}
              onChange={(e) => setDepositNote(e.target.value)}
              placeholder="e.g. Physical student ID card held at cage desk during checkout"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </section>

      {/* 3. Safety Training Requirements (Repeatable Rows) */}
      <section className="p-6 sm:p-7 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-slate-400">
              Prerequisite Safety Training Requirements
            </h2>
            <p className="text-xs text-slate-500">
              Students must hold a verified credential of these types before booking this resource.
            </p>
          </div>
          <button
            type="button"
            onClick={addRequirement}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Requirement</span>
          </button>
        </div>

        {requirements.length === 0 ? (
          <p className="text-xs text-slate-500 italic p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            No prerequisite certifications required. All students can reserve this resource.
          </p>
        ) : (
          <div className="space-y-3">
            {requirements.map((req, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center gap-3"
              >
                <div className="flex-1 w-full space-y-2 sm:space-y-0 sm:flex sm:gap-3">
                  <div className="sm:w-1/2">
                    <input
                      type="text"
                      required
                      value={req.credential_type}
                      onChange={(e) => updateRequirement(idx, "credential_type", e.target.value)}
                      placeholder="Credential title, e.g. 3D Printer Safety Training"
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="sm:w-1/2">
                    <input
                      type="text"
                      value={req.description || ""}
                      onChange={(e) => updateRequirement(idx, "description", e.target.value)}
                      placeholder="Short description or syllabus link..."
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeRequirement(idx)}
                  aria-label="Remove requirement"
                  className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors self-end sm:self-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. Availability Windows (Repeatable Rows) */}
      <section className="p-6 sm:p-7 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-slate-400">
              Operating Availability Windows
            </h2>
            <p className="text-xs text-slate-500">Days of the week and operating hours.</p>
          </div>
          <button
            type="button"
            onClick={addWindow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Window</span>
          </button>
        </div>

        {availabilityWindows.length === 0 ? (
          <p className="text-xs text-slate-500 italic p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            No availability windows configured. Resource cannot be booked.
          </p>
        ) : (
          <div className="space-y-2">
            {availabilityWindows.map((win, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-wrap sm:flex-nowrap items-center gap-3"
              >
                <div className="w-36">
                  <select
                    value={win.day_of_week}
                    onChange={(e) => updateWindow(idx, "day_of_week", Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">From:</span>
                  <input
                    type="time"
                    required
                    value={win.start_time.slice(0, 5)}
                    onChange={(e) => updateWindow(idx, "start_time", e.target.value)}
                    className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <span className="text-xs text-slate-500">To:</span>
                  <input
                    type="time"
                    required
                    value={win.end_time.slice(0, 5)}
                    onChange={(e) => updateWindow(idx, "end_time", e.target.value)}
                    className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => removeWindow(idx)}
                  aria-label="Remove availability window"
                  className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors ml-auto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. Assigned Lab Tech Managers */}
      <section className="p-6 sm:p-7 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider text-slate-400">
            Assigned Lab Tech Managers
          </h2>
          <p className="text-xs text-slate-500">
            Selected staff will be granted permissions to approve bookings, supervise checkouts, and log condition reports.
          </p>
        </div>

        {availableManagers.length === 0 ? (
          <p className="text-xs text-slate-500 italic p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            No technicians with role &apos;manager&apos; are currently registered.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availableManagers.map((mgr) => {
              const checked = selectedManagerIds.includes(mgr.id);
              return (
                <label
                  key={mgr.id}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                    checked
                      ? "bg-indigo-950/40 border-indigo-500/50"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleManager(mgr.id)}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-700 mt-0.5 focus:ring-indigo-500 focus:ring-offset-slate-900"
                  />
                  <div className="text-xs space-y-0.5">
                    <span className="font-semibold text-white block">{mgr.name}</span>
                    <span className="font-mono text-slate-400 text-[11px] block">{mgr.email}</span>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </section>

      {/* Submit footer */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
        <Link
          href="/my-resources"
          className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending || !canSave}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:cursor-not-allowed text-white font-medium text-xs shadow-lg shadow-indigo-600/30 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {isPending ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>{isEditing ? "Save Changes" : "Create Resource"}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}

