import { requireUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import { IncidentsView, IncidentListItem } from "@/components/incidents/incidents-view";
import { ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function IncidentsPage() {
  const session = await requireUser();
  const admin = createAdminClient();

  let incidentsQuery = admin
    .from("incidents")
    .select(`
      id,
      booking_id,
      resource_id,
      reported_by,
      incident_type,
      severity,
      description,
      ai_summary,
      status,
      resolution,
      strike_applied,
      dispute_note,
      created_at,
      resource:resources(id, name, category),
      reporter:profiles!reported_by(id, full_name, email),
      booking:bookings(id, start_at, end_at, borrower:profiles!user_id(id, full_name, email))
    `);

  if (session.role === "admin") {
    // Admins see all incidents
  } else if (["owner", "manager"].includes(session.role)) {
    // Owners & managers see incidents for resources they manage, plus incidents on their own reservations
    const { data: owned } = await admin
      .from("resources")
      .select("id")
      .eq("owner_id", session.user.id);

    const { data: managed } = await admin
      .from("resource_managers")
      .select("resource_id")
      .eq("user_id", session.user.id);

    const managedIds = new Set<string>();
    owned?.forEach((r) => managedIds.add(r.id));
    managed?.forEach((m) => managedIds.add(m.resource_id));

    const { data: userBookings } = await admin
      .from("bookings")
      .select("id")
      .eq("user_id", session.user.id);

    const userBookingIds = userBookings?.map((b) => b.id) || [];

    const conditions: string[] = [`reported_by.eq.${session.user.id}`];
    if (managedIds.size > 0) {
      conditions.push(`resource_id.in.(${Array.from(managedIds).join(",")})`);
    }
    if (userBookingIds.length > 0) {
      conditions.push(`booking_id.in.(${userBookingIds.join(",")})`);
    }

    incidentsQuery = incidentsQuery.or(conditions.join(","));
  } else {
    // Students/users see incidents on their own bookings or reported by them
    const { data: userBookings } = await admin
      .from("bookings")
      .select("id")
      .eq("user_id", session.user.id);

    const userBookingIds = userBookings?.map((b) => b.id) || [];

    if (userBookingIds.length > 0) {
      incidentsQuery = incidentsQuery.or(
        `reported_by.eq.${session.user.id},booking_id.in.(${userBookingIds.join(",")})`
      );
    } else {
      incidentsQuery = incidentsQuery.eq("reported_by", session.user.id);
    }
  }

  const { data: rawIncidents, error } = (await incidentsQuery.order("created_at", {
    ascending: false,
  })) as { data: any[] | null; error: any };

  const incidents: IncidentListItem[] = (rawIncidents || []).map((inc: any) => ({
    id: inc.id,
    booking_id: inc.booking_id,
    resource_id: inc.resource_id,
    reported_by: inc.reported_by,
    incident_type: inc.incident_type,
    severity: inc.severity,
    description: inc.description,
    ai_summary: inc.ai_summary,
    status: inc.status,
    resolution: inc.resolution,
    strike_applied: inc.strike_applied,
    dispute_note: inc.dispute_note,
    created_at: inc.created_at,
    resource: inc.resource,
    reporter: inc.reporter,
    booking: inc.booking
      ? {
          id: inc.booking.id,
          start_at: inc.booking.start_at,
          end_at: inc.booking.end_at,
          borrower: inc.booking.borrower,
        }
      : null,
  }));

  return (
    <AuthenticatedLayout>
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        <div className="border-b border-slate-800 pb-5">
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-rose-500" />
            <span>Incident &amp; Damage Tracking</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Review reported hardware defects, delays, hazardous safety events, and dispute reviews.
          </p>
        </div>

        <IncidentsView incidents={incidents} viewerRole={session.role} />
      </div>
    </AuthenticatedLayout>
  );
}
