import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import { HandoversView, HandoverBookingItem } from "@/components/handovers/handovers-view";
import { ArrowLeftRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HandoversPage() {
  const session = await requireRole(["owner", "manager", "admin"]);
  const admin = createAdminClient();

  // 1. Determine resources managed by viewer
  let resourceIds: string[] | null = null;

  if (session.role !== "admin") {
    const { data: owned } = await admin
      .from("resources")
      .select("id")
      .eq("owner_id", session.user.id);

    const { data: managed } = await admin
      .from("resource_managers")
      .select("resource_id")
      .eq("user_id", session.user.id);

    const ids = new Set<string>();
    owned?.forEach((r) => ids.add(r.id));
    managed?.forEach((m) => ids.add(m.resource_id));

    resourceIds = Array.from(ids);

    if (resourceIds.length === 0) {
      return (
        <AuthenticatedLayout allowedRoles={["owner", "manager", "admin"]}>
          <div className="space-y-6 max-w-5xl">
            <div className="border-b border-slate-800 pb-5">
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
                <ArrowLeftRight className="w-6 h-6 text-indigo-400" />
                <span>Active Handovers &amp; Condition Reports</span>
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                You do not currently manage any active campus resources.
              </p>
            </div>
            <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-sm">
              Create a resource or ask an administrator to assign you as a lab manager.
            </div>
          </div>
        </AuthenticatedLayout>
      );
    }
  }

  // 2. Query approved bookings (for today & upcoming) and checked_out bookings
  let approvedQuery = admin
    .from("bookings")
    .select(`
      id,
      status,
      start_at,
      end_at,
      checked_out_at,
      purpose,
      priority_tier,
      resource:resources(id, name, category, location),
      user:profiles!user_id(id, full_name, email, department, strikes)
    `)
    .eq("status", "approved")
    .order("start_at", { ascending: true });

  let checkedOutQuery = admin
    .from("bookings")
    .select(`
      id,
      status,
      start_at,
      end_at,
      checked_out_at,
      purpose,
      priority_tier,
      resource:resources(id, name, category, location),
      user:profiles!user_id(id, full_name, email, department, strikes)
    `)
    .eq("status", "checked_out")
    .order("end_at", { ascending: true });

  if (resourceIds !== null) {
    approvedQuery = approvedQuery.in("resource_id", resourceIds);
    checkedOutQuery = checkedOutQuery.in("resource_id", resourceIds);
  }

  const [{ data: approvedData }, { data: checkedOutData }] = await Promise.all([
    approvedQuery as any,
    checkedOutQuery as any,
  ]);

  const mapToItem = (b: any): HandoverBookingItem => ({
    id: b.id,
    status: b.status,
    start_at: b.start_at,
    end_at: b.end_at,
    checked_out_at: b.checked_out_at,
    purpose: b.purpose,
    priority_tier: b.priority_tier,
    resource: {
      id: b.resource?.id || "",
      name: b.resource?.name || "Equipment",
      category: b.resource?.category || "equipment",
      location: b.resource?.location || null,
    },
    user: {
      id: b.user?.id || "",
      full_name: b.user?.full_name || null,
      email: b.user?.email || null,
      department: b.user?.department || null,
      strikes: b.user?.strikes || 0,
    },
  });

  const approvedBookings: HandoverBookingItem[] = (approvedData || []).map(mapToItem);
  const checkedOutBookings: HandoverBookingItem[] = (checkedOutData || []).map(mapToItem);

  return (
    <AuthenticatedLayout allowedRoles={["owner", "manager", "admin"]}>
      <div className="space-y-6 max-w-5xl">
        <div className="border-b border-slate-800 pb-5">
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ArrowLeftRight className="w-6 h-6 text-indigo-400" />
            <span>Active Handovers &amp; Condition Reports</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Issue gear checkouts, inspect returned equipment, log condition grades, and record condition photos.
          </p>
        </div>

        <HandoversView
          approvedBookings={approvedBookings}
          checkedOutBookings={checkedOutBookings}
        />
      </div>
    </AuthenticatedLayout>
  );
}
