"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  Upload,
  FileCheck,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Loader2,
  FileText,
  X,
} from "lucide-react";
import { uploadCredentialAction } from "@/actions/credentials";
import { useToast } from "@/components/ui/toast";

interface CredentialUploadFormProps {
  availableTypes: string[];
}

export function CredentialUploadForm({ availableTypes }: CredentialUploadFormProps) {
  const searchParams = useSearchParams();
  const preselectedType = searchParams.get("type");

  const [selectedType, setSelectedType] = useState<string>("");
  const [customType, setCustomType] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { success, error: toastError } = useToast();

  useEffect(() => {
    if (preselectedType) {
      if (availableTypes.includes(preselectedType)) {
        setSelectedType(preselectedType);
      } else {
        setSelectedType("Other");
        setCustomType(preselectedType);
      }
    } else if (availableTypes.length > 0 && !selectedType) {
      setSelectedType(availableTypes[0]);
    }
  }, [preselectedType, availableTypes]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    if (!e.target.files || e.target.files.length === 0) {
      setSelectedFile(null);
      return;
    }

    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) {
      setFileError("File exceeds the 5MB maximum size limit.");
      setSelectedFile(null);
      return;
    }

    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowed.includes(file.type)) {
      setFileError("Only PDF and image files (PNG, JPG, WEBP) are supported.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType) {
      toastError("Please choose a credential type.");
      return;
    }

    if (selectedType === "Other" && !customType.trim()) {
      toastError("Please specify the custom credential name.");
      return;
    }

    if (!selectedFile) {
      toastError("Please select a certificate or proof document to upload.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("credential_type", selectedType);
      if (selectedType === "Other") {
        formData.append("custom_type", customType.trim());
      }
      if (expiresAt) {
        formData.append("expires_at", expiresAt);
      }
      formData.append("file", selectedFile);

      const res = await uploadCredentialAction(formData);
      if (res.ok) {
        success("Credential submitted for staff review.");
        setSelectedFile(null);
        setExpiresAt("");
        if (selectedType === "Other") setCustomType("");
      } else {
        toastError(res.error || "Failed to submit credential.");
      }
    });
  };

  return (
    <div id="upload" className="scroll-mt-8 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-5">
      <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-4">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
          <Upload className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">Upload New Credential or Safety Induction</h2>
          <p className="text-xs text-slate-400">
            Submit certifications, safety workshop completion letters, or driver licenses for laboratory access
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Certification / Credential Type <span className="text-rose-400">*</span>
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
            >
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
              <option value="Other">Other (Custom Certification)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Expiration Date (Optional)
            </label>
            <div className="relative">
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Leave empty if the certification has perpetual validity.
            </p>
          </div>
        </div>

        {selectedType === "Other" && (
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Specify Custom Credential Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              placeholder="e.g. Cleanroom Protocol & PPE Certification"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        )}

        {/* File Upload Box */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Proof Document (PDF or Image, max 5MB) <span className="text-rose-400">*</span>
          </label>
          <div className="border-2 border-dashed border-slate-800 hover:border-slate-700 transition-colors rounded-xl p-5 text-center bg-slate-950/40">
            {selectedFile ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-indigo-950/30 border border-indigo-800/40 text-left max-w-md mx-auto">
                <div className="flex items-center gap-3 truncate">
                  <FileText className="w-5 h-5 text-indigo-400 shrink-0" />
                  <div className="truncate">
                    <p className="text-xs font-medium text-white truncate">{selectedFile.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {selectedFile.type || "Document"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="p-1 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="text-xs text-slate-400">
                  <label
                    htmlFor="credential-file-input"
                    className="cursor-pointer text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2"
                  >
                    Click to browse
                  </label>{" "}
                  or drag &amp; drop certificate file
                </div>
                <p className="text-[11px] text-slate-500">
                  Accepted formats: PDF, PNG, JPG, JPEG, WEBP up to 5MB
                </p>
                <input
                  id="credential-file-input"
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            )}
          </div>
          {fileError && (
            <p className="text-xs text-rose-400 flex items-center gap-1.5 mt-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{fileError}</span>
            </p>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isPending || !selectedFile}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading Document...</span>
              </>
            ) : (
              <>
                <FileCheck className="w-4 h-4" />
                <span>Submit for Verification</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

