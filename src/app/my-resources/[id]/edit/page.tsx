import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageResource } from "@/lib/permissions";
import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import { ResourceForm } from "@/components/resources/resource-form";
import { notFound, redirect } from "next/navigation";
import { ResourceUpsertInput } from "@/lib/validations";

export default async function EditResourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireRole(["owner", "admin"]);
  const admin = createAdminClient();

  // 1. Fetch resource with relations
  const { data: resource, error } = (await admin
    .from("resources")
    .select(`
      *,
      resource_requirements(*),
      availability_windows(*),
      resource_managers(user_id)
    `)
    .eq("id", id)
    .maybeSingle()) as { data: any; error: any };

  if (error || !resource) {
    notFound();
  }

  // 2. Permission check
  const hasPermission = await canManageResource(session, resource);
  if (!hasPermission) {
    redirect("/my-resources");
  }

  // 3. Fetch managers
  const { data: managers } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .in("role", ["manager", "admin"]);

  const managerOptions = (managers || []).map((m) => ({
    id: m.id,
    name: m.full_name || m.email || "Staff",
    email: m.email || "",
  }));

  const initialData: ResourceUpsertInput = {
    id: resource.id,
    name: resource.name,
    category: resource.category,
    location: resource.location || "",
    description: resource.description,
    image_path: resource.image_path,
    is_active: resource.is_active,
    requires_supervision: resource.requires_supervision,
    max_duration_hours: resource.max_duration_hours,
    buffer_minutes: resource.buffer_minutes,
    usage_rules: resource.usage_rules,
    deposit_note: resource.deposit_note,
    requirements: (resource.resource_requirements || []).map((r: any) => ({
      id: r.id,
      credential_type: r.credential_type,
      description: r.description,
    })),
    availability_windows: (resource.availability_windows || []).map((w: any) => ({
      id: w.id,
      day_of_week: w.day_of_week,
      start_time: w.start_time.slice(0, 5),
      end_time: w.end_time.slice(0, 5),
    })),
    manager_ids: (resource.resource_managers || []).map((rm: any) => rm.user_id),
  };

  const isOwnerVerified = session.role === "admin" || session.profile.owner_verified;

  return (
    <AuthenticatedLayout allowedRoles={["owner", "admin"]}>
      <ResourceForm
        initialData={initialData}
        availableManagers={managerOptions}
        isOwnerVerified={isOwnerVerified}
        isAdmin={session.role === "admin"}
      />
    </AuthenticatedLayout>
  );
}
