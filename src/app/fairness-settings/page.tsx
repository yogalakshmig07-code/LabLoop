import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import { Scale } from "lucide-react";

export default async function FairnessSettingsPage() {
  return (
    <AuthenticatedLayout allowedRoles={["admin"]}>
      <div className="space-y-6">
        <div className="border-b border-slate-800 pb-5">
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Scale className="w-6 h-6 text-rose-400" />
            <span>Fairness &amp; Quota Settings</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure campus-wide booking limits, weekly hour caps per category, and strike penalty thresholds.
          </p>
        </div>

        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <Scale className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold text-white">Policy Parameters</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Manage system limits: max active bookings (default: 3), max hours/week per category (default: 8h),
            and strike threshold (default: 3).
          </p>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
