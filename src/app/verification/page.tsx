import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import { requireRole } from "@/lib/session";
import { getPendingCredentialsForViewer } from "@/lib/credentials";
import { VerificationQueue } from "@/components/verification/verification-queue";
import { Award } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function VerificationPage() {
  const session = await requireRole(["owner", "manager", "admin"]);
  const pendingItems = await getPendingCredentialsForViewer(session.user.id, session.role);

  return (
    <AuthenticatedLayout allowedRoles={["owner", "manager", "admin"]}>
      <div className="space-y-6">
        <div className="border-b border-slate-800 pb-5">
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Award className="w-6 h-6 text-indigo-400" />
            <span>Credential Verification Queue</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Review student safety induction submissions, verify proof documents, and grant equipment certifications.
          </p>
        </div>

        <VerificationQueue initialItems={pendingItems} viewerRole={session.role} />
      </div>
    </AuthenticatedLayout>
  );
}

