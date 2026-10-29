"use client";

import React, { useState, useTransition } from "react";
import {
  Award,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Loader2,
  FileText,
  AlertCircle,
} from "lucide-react";
import { CredentialStatus } from "@/types/db";
import { getCredentialViewUrlAction } from "@/actions/credentials";
import { useToast } from "@/components/ui/toast";
import { format } from "date-fns";

export interface UserCredentialItem {
  id: string;
  credential_type: string;
  file_path: string | null;
  status: CredentialStatus;
  verified_by: string | null;
  verified_at: string | null;
  expires_at: string | null;
  note: string | null;
  created_at: string;
}

interface CredentialListProps {
  credentials: UserCredentialItem[];
}

export function CredentialList({ credentials }: CredentialListProps) {
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { error: toastError } = useToast();

  const handleViewFile = (id: string) => {
    setOpeningId(id);
    startTransition(async () => {
      const res = await getCredentialViewUrlAction(id);
      if (res.ok) {
        if (res.data) window.open(res.data, "_blank", "noopener,noreferrer");
      } else {
        toastError(res.error || "Unable to open credential document.");
      }
      setOpeningId(null);
    });
  };

  const getStatusBadge = (status: CredentialStatus) => {
    switch (status) {
      case "verified":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Verified</span>
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Review</span>
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            <span>Rejected</span>
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Expired</span>
          </span>
        );
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Your Credentials &amp; Certifications</h2>
            <p className="text-xs text-slate-400">
              Verified certifications allow instant booking across campus labs and equipment
            </p>
          </div>
        </div>
        <span className="text-xs text-slate-400">
          {credentials.length} certification{credentials.length !== 1 ? "s" : ""} on record
        </span>
      </div>

      {credentials.length === 0 ? (
        <div className="py-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-800/60 text-slate-500 flex items-center justify-center mx-auto">
            <Award className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-300">No Credentials Submitted Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Upload your training cards or safety workshop certificates below to unlock specialised lab resources.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/80 rounded-xl bg-slate-950/60 border border-slate-800/80 overflow-hidden">
          {credentials.map((cred) => {
            const isOpening = openingId === cred.id && isPending;
            return (
              <div key={cred.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-sm font-semibold text-white">{cred.credential_type}</span>
                    {getStatusBadge(cred.status)}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      Uploaded {format(new Date(cred.created_at), "MMM d, yyyy")}
                    </span>

                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      {cred.expires_at ? `Expires ${cred.expires_at}` : "Perpetual / No Expiry"}
                    </span>
                  </div>

                  {cred.note && (
                    <div className="mt-2 text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-200">Reviewer Note: </span>
                        <span>{cred.note}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
                  {cred.file_path && (
                    <button
                      type="button"
                      disabled={isOpening}
                      onClick={() => handleViewFile(cred.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50"
                    >
                      {isOpening ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Opening...</span>
                        </>
                      ) : (
                        <>
                          <FileText className="w-3.5 h-3.5 text-indigo-400" />
                          <span>View Proof</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
