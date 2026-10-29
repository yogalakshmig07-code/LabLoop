import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import { Users, ShieldAlert } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/session";
import { UserList, UserProfileItem } from "@/components/admin/user-list";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireRole(["admin"]);
  const admin = createAdminClient();

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, full_name, email, role, department, owner_verified, strikes, created_at")
    .order("created_at", { ascending: false });

  const users: UserProfileItem[] = (profiles as any[]) || [];

  return (
    <AuthenticatedLayout allowedRoles={["admin"]}>
      <div className="space-y-6">
        <div className="border-b border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <Users className="w-6 h-6 text-rose-400" />
              <span>Campus User &amp; Role Management</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Admin console: adjust campus user roles, oversee safety strikes, and authorize faculty resource owners.
            </p>
          </div>
        </div>

        {error ? (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <p className="text-sm">Unable to load campus directory: {error.message}</p>
          </div>
        ) : (
          <UserList initialUsers={users} />
        )}
      </div>
    </AuthenticatedLayout>
  );
}

