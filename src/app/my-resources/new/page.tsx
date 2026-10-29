import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import { ResourceForm } from "@/components/resources/resource-form";

export default async function NewResourcePage() {
  const session = await requireRole(["owner", "admin"]);
  const admin = createAdminClient();

  // Fetch available managers
  const { data: managers } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .in("role", ["manager", "admin"]);

  const managerOptions = (managers || []).map((m) => ({
    id: m.id,
    name: m.full_name || m.email || "Staff",
    email: m.email || "",
  }));

  const isOwnerVerified = session.role === "admin" || session.profile.owner_verified;

  return (
    <AuthenticatedLayout allowedRoles={["owner", "admin"]}>
      <ResourceForm
        availableManagers={managerOptions}
        isOwnerVerified={isOwnerVerified}
        isAdmin={session.role === "admin"}
      />
    </AuthenticatedLayout>
  );
}

