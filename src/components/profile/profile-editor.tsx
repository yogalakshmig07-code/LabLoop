"use client";

import React, { useState, useTransition } from "react";
import { UserCheck, Shield, AlertTriangle, CheckCircle2, Save, Loader2, Building, Mail } from "lucide-react";
import { updateProfileAction } from "@/actions/profile";
import { useToast } from "@/components/ui/toast";
import { UserRole } from "@/types/db";

interface ProfileEditorProps {
  initialProfile: {
    id: string;
    email: string;
    full_name: string | null;
    role: UserRole;
    department: string | null;
    strikes: number;
    owner_verified: boolean;
  };
}

export function ProfileEditor({ initialProfile }: ProfileEditorProps) {
  const [fullName, setFullName] = useState(initialProfile.full_name || "");
  const [department, setDepartment] = useState(initialProfile.department || "");
  const [isPending, startTransition] = useTransition();
  const { success, error: toastError } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toastError("Please enter your name.");
      return;
    }

    startTransition(async () => {
      const res = await updateProfileAction({
        full_name: fullName.trim(),
        department: department.trim(),
      });

      if (res.ok) {
        success("Profile details updated successfully.");
      } else {
        toastError(res.error || "Failed to update profile.");
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Account Details & Edit Form */}
      <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Campus Profile Details</h2>
              <p className="text-xs text-slate-400">Update your public identity and department affiliation</p>
            </div>
          </div>
          <span className="text-xs uppercase font-mono px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            {initialProfile.role}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Full Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Priya Sharma"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Department / Program
              </label>
              <div className="relative">
                <Building className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Computer Science & Engineering"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9.5 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Campus Email (Verified Auth)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={initialProfile.email}
                disabled
                className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl pl-9.5 pr-3.5 py-2.5 text-sm text-slate-400 cursor-not-allowed"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Email is managed via university central authentication.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Profile Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Reliability Record & Strikes Card */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              initialProfile.strikes > 0
                ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
            }`}>
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Reliability Record</h2>
              <span className="text-xs text-slate-400">Campus Standing &amp; Reputation</span>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-400">Recorded Strikes</span>
              <div className="flex items-center gap-1.5">
                <span className="text-3xl font-extrabold text-white font-mono">
                  {initialProfile.strikes}
                </span>
                <span className="text-xs text-slate-500">strikes</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs leading-relaxed text-slate-300">
              <p className="font-medium text-slate-200 mb-1 flex items-center gap-1.5">
                {initialProfile.strikes === 0 ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Clean Safety Record</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Penalty Notice</span>
                  </>
                )}
              </p>
              <p className="text-slate-400">
                Strikes lower your waitlist priority; they never block you automatically. A person reviews every penalty.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-2 text-[11px] text-slate-500 border-t border-slate-800/60">
          Responsible equipment usage and on-time returns ensure priority access for high-demand lab benches.
        </div>
      </div>
    </div>
  );
}

