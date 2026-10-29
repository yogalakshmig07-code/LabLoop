import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import { AlertTriangle } from "lucide-react";

export default async function IncidentsPage() {
  return (
    <AuthenticatedLayout allowedRoles={["owner", "manager", "admin"]}>
      <div className="space-y-6">
        <div className="border-b border-slate-800 pb-5">
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <AlertTriangle className="w-6 h-6 text-indigo-400" />
            <span>Incident &amp; Damage Reports</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Review reported hardware damages, delays, conflicts, and apply or waive strikes.
          </p>
        </div>

        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold text-white">Incident Tracking</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Incident reports, AI summaries, and dispute resolution workflows will be presented here.
          </p>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
