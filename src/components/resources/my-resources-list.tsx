"use client";

import React, { useTransition } from "react";
import Link from "next/link";
import {
  PackageCheck,
  Edit,
  MapPin,
  Clock,
  Shield,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building,
  Monitor,
  Wrench,
  Cpu,
  Video,
} from "lucide-react";
import { toggleResourceActiveAction } from "@/actions/resources";
import { useToast } from "@/components/ui/toast";
import { ResourceCategory } from "@/types/db";

export interface MyResourceItem {
  id: string;
  name: string;
  category: ResourceCategory;
  location: string | null;
  image_path: string | null;
  is_active: boolean;
  requires_supervision: boolean;
  max_duration_hours: number;
  buffer_minutes: number;
  requirements_count: number;
  windows_count: number;
  created_at: string;
}

export function MyResourcesList({ resources }: { resources: MyResourceItem[] }) {
  const { success, error: toastError } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleToggle = (id: string, currentState: boolean) => {
    startTransition(async () => {
      const res = await toggleResourceActiveAction(id, !currentState);
      if (res.ok) {
        success(`Resource ${!currentState ? "activated" : "deactivated"} successfully.`);
      } else {
        toastError(res.error);
      }
    });
  };

  const getCategoryIcon = (cat: ResourceCategory) => {
    switch (cat) {
      case "lab":
        return <Wrench className="w-4 h-4 text-indigo-400" />;
      case "computing":
        return <Cpu className="w-4 h-4 text-indigo-400" />;
      case "media":
        return <Video className="w-4 h-4 text-indigo-400" />;
      case "room":
        return <Building className="w-4 h-4 text-indigo-400" />;
      case "equipment":
      default:
        return <Monitor className="w-4 h-4 text-indigo-400" />;
    }
  };

  if (resources.length === 0) {
    return (
      <div className="py-16 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="w-12 h-12 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
          <PackageCheck className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-white">No resources registered yet</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Add laboratory equipment, workshop benches, or room spaces to allow students to reserve them.
        </p>
        <Link
          href="/my-resources/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors mt-2"
        >
          <span>Create your first resource</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-800/80 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
      {resources.map((item) => (
        <div
          key={item.id}
          className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-start gap-4">
            {/* Thumbnail */}
            <div className="relative w-14 h-14 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
              {item.image_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image_path} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                getCategoryIcon(item.category)
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Link
                  href={`/resources/${item.id}`}
                  className="font-bold text-sm text-white hover:text-indigo-300 transition-colors focus:outline-none focus:underline"
                >
                  {item.name}
                </Link>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-950 text-slate-400 border border-slate-800 capitalize">
                  {item.category}
                </span>
                {item.requires_supervision && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    Supervision
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                {item.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span>{item.location}</span>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Max {item.max_duration_hours}h</span>
                </span>
                <span>
                  {item.requirements_count} requirement(s) • {item.windows_count} window(s)
                </span>
              </div>
            </div>
          </div>

          {/* Controls: Active Toggle + Edit Button */}
          <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
            {/* Active Toggle Switch */}
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleToggle(item.id, item.is_active)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                item.is_active
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                  : "bg-slate-950 border-slate-700 text-slate-500 hover:text-slate-300"
              }`}
            >
              {item.is_active ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Active</span>
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Inactive</span>
                </>
              )}
            </button>

            {/* View Details */}
            <Link
              href={`/resources/${item.id}`}
              className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
              title="View public details"
            >
              <Eye className="w-4 h-4" />
            </Link>

            {/* Edit */}
            <Link
              href={`/my-resources/${item.id}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Edit</span>
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

