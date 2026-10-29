import { requireUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ShieldAlert } from "lucide-react";
import { IncidentReportForm } from "@/components/incidents/incident-report-form";

export const dynamic = "force-dynamic";

export default async function ReportIncidentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireUser();
  const admin = createAdminClient();

  // Fetch booking with resource and borrower
  const { data: booking, error } = (await admin
    .from("bookings")
    .select(`
      id,
      user_id,
      resource_id,
      status,
      start_at,
      end_at,
      resource:resources(id, name, category, location, owner_id),
      user:profiles!user_id(id, full_name, email)
    `)
    .eq("id", id)
    .maybeSingle()) as { data: any; error: any };

  if (error || !booking) {
    notFound();
  }

  // Authorization check: both the borrower and resource custodians (owner, manager, admin) can report
  const isBorrower = booking.user_id === session.user.id;
  const isAdmin = session.role === "admin";
  const isOwner = booking.resource?.owner_id === session.user.id;

  let isManager = false;
  if (!isBorrower && !isAdmin && !isOwner) {
    const { data: mgr } = await admin
      .from("resource_managers")
      .select("resource_id")
      .eq("resource_id", booking.resource_id)
      .eq("user_id", session.user.id)
      .maybeSingle();
    isManager = Boolean(mgr);
  }

  if (!isBorrower && !isAdmin && !isOwner && !isManager) {
    notFound();
  }

  return (
    <AuthenticatedLayout>
      <div className="space-y-6 max-w-2xl mx-auto pb-12">
        <div>
          <Link
            href={`/bookings/${id}`}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Reservation Details</span>
          </Link>
        </div>

        <div className="border-b border-slate-800 pb-5">
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-rose-500" />
            <span>Report an Incident or Hazard</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            File an official report for hardware damage, return delay, facility access conflict, or safety hazard.
          </p>
        </div>

        <IncidentReportForm
          bookingId={booking.id}
          resourceId={booking.resource_id}
          resourceName={booking.resource?.name || "Equipment"}
          resourceCategory={booking.resource?.category}
          borrowerName={booking.user?.full_name || booking.user?.email}
        />
      </div>
    </AuthenticatedLayout>
  );
}

