import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import { ScrollText } from "lucide-react";

export default async function AuditLogPage() {
  return (
    <AuthenticatedLayout allowedRoles={["admin"]}>
      <div className="space-y-6">
        <div className="border-b border-slate-800 pb-5">
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ScrollText className="w-6 h-6 text-rose-400" />
            <span>Immutable Audit Log</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Cryptographically backed append-only audit trail recording all booking transitions, approvals, handovers, and incidents.
          </p>
        </div>

        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <ScrollText className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold text-white">System Event Log</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Audit log timeline entries will be streamed here with filterable actors, action types, and JSON metadata payloads.
          </p>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
