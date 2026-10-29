import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import { ArrowLeftRight } from "lucide-react";

export default async function HandoversPage() {
  return (
    <AuthenticatedLayout allowedRoles={["owner", "manager", "admin"]}>
      <div className="space-y-6">
        <div className="border-b border-slate-800 pb-5">
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ArrowLeftRight className="w-6 h-6 text-indigo-400" />
            <span>Active Handovers &amp; Condition Reports</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Issue gear checkouts, inspect returned equipment, log condition grades, and record photos.
          </p>
        </div>

        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold text-white">Equipment Handovers</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Active checkouts and overdue alerts will appear here for technicians to manage physical gear exchanges.
          </p>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
