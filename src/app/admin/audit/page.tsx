import { requireRole } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuditLogView, AuditLogItem } from "@/components/audit/audit-log-view";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  await requireRole(["admin"]);
  const admin = createAdminClient();

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
    .order("created_at", { ascending: false })
    .limit(500);

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
    <AuthenticatedLayout allowedRoles={["admin"]}>
      <AuditLogView
        entries={entries}
        title="Campus Central Audit Trail"
        subtitle="Unrestricted system-wide audit record tracking every lifecycle state transition, approval, handover, dispute, and configuration change."
        isScoped={false}
      />
    </AuthenticatedLayout>
  );
}

