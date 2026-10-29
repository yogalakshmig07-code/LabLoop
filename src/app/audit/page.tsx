import { requireRole } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuditLogView, AuditLogItem } from "@/components/audit/audit-log-view";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ScopedAuditPage() {
  const session = await requireRole(["owner", "manager", "admin"]);
  const admin = createAdminClient();

  // If admin, they can either view scoped or admin audit; if viewing /audit, let's show all or their resources
  if (session.role === "admin") {
    // Admin redirected to /admin/audit for full central log
    redirect("/admin/audit");
  }

  // Determine managed resources for this owner/manager
  const { data: owned } = await admin
    .from("resources")
    .select("id")
    .eq("owner_id", session.user.id);

  const { data: managed } = await admin
    .from("resource_managers")
    .select("resource_id")
    .eq("user_id", session.user.id);

  const resourceIds = new Set<string>();
  owned?.forEach((r) => resourceIds.add(r.id));
  managed?.forEach((m) => resourceIds.add(m.resource_id));

  const managedIds = Array.from(resourceIds);

  if (managedIds.length === 0) {
    return (
      <AuthenticatedLayout allowedRoles={["owner", "manager", "admin"]}>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-white">Resource Audit Trail</h1>
          <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-sm">
            You do not currently manage any active campus resources to view audit records for.
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  // Fetch audit records where resource_id is in managedIds OR actor_id is the user
  const { data } = await admin
    .from("audit_log")
    .select(`
      id,
      created_at,
      actor_id,
      actor_name,
      action,
      entity_type,
      entity_id,
      booking_id,
      resource_id,
      reason,
      details,
      actor:profiles!actor_id(full_name, email)
    `)
    .in("resource_id", managedIds)
    .order("created_at", { ascending: false })
    .limit(300);

  const entries: AuditLogItem[] = (data || []).map((row: any) => ({
    id: row.id,
    created_at: row.created_at,
    actor_id: row.actor_id,
    actor_name: row.actor?.full_name || row.actor_name || "System",
    actor_email: row.actor?.email,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    booking_id: row.booking_id,
    resource_id: row.resource_id,
    reason: row.reason,
    details: row.details,
  }));

  return (
    <AuthenticatedLayout allowedRoles={["owner", "manager", "admin"]}>
      <AuditLogView
        entries={entries}
        title="Facility Audit Trail"
        subtitle="Scoped audit log recording all reservation transitions, handovers, checkouts, and incidents for the equipment you supervise."
        isScoped={true}
      />
    </AuthenticatedLayout>
  );
}

