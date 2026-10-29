import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import { MyResourcesList, MyResourceItem } from "@/components/resources/my-resources-list";
import Link from "next/link";
import { PackageCheck, Plus, AlertCircle } from "lucide-react";

export default async function MyResourcesPage() {
  const session = await requireRole(["owner", "admin"]);
  const admin = createAdminClient();

  const isOwnerVerified = session.role === "admin" || session.profile.owner_verified;

  // Fetch resources
  let query = admin
    .from("resources")
    .select(`
      id,
      name,
      category,
      location,
      image_path,
      is_active,
      requires_supervision,
      max_duration_hours,
      buffer_minutes,
      created_at,
      resource_requirements(count),
      availability_windows(count)
    `)
    .order("created_at", { ascending: false });

  if (session.role === "owner") {
    query = query.eq("owner_id", session.user.id);
  }

  const { data: rawResources } = await query;

  const resources: MyResourceItem[] = (rawResources || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    location: r.location,
    image_path: r.image_path,
    is_active: r.is_active,
    requires_supervision: r.requires_supervision,
    max_duration_hours: r.max_duration_hours,
    buffer_minutes: r.buffer_minutes,
    requirements_count: r.resource_requirements?.[0]?.count || 0,
    windows_count: r.availability_windows?.[0]?.count || 0,
    created_at: r.created_at,
  }));

  return (
    <AuthenticatedLayout allowedRoles={["owner", "admin"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              <PackageCheck className="w-7 h-7 text-indigo-400" />
              <span>My Managed Resources</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Configure equipment visibility, update operating windows, and delegate lab technicians.
            </p>
          </div>

          <div>
            {isOwnerVerified ? (
              <Link
                href="/my-resources/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/30 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Resource</span>
              </Link>
            ) : (
              <button
                disabled
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 text-slate-500 text-xs font-medium cursor-not-allowed"
                title="Account pending admin verification"
              >
                <Plus className="w-4 h-4" />
                <span>Add Resource (Unverified)</span>
              </button>
            )}
          </div>
        </div>

        {/* Unverified Owner Warning */}
        {!isOwnerVerified && (
          <div
            role="alert"
            className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold">Faculty Owner Verification Required</strong>
              <span>
                Your account is currently pending administrative verification. Until an administrator verifies your faculty standing, you cannot publish new lab resources.
              </span>
            </div>
          </div>
        )}

        {/* Resources Table List */}
        <MyResourcesList resources={resources} />
      </div>
    </AuthenticatedLayout>
  );
}
