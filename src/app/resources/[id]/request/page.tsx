
import { requireUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, CalendarClock, AlertCircle } from "lucide-react";
import { RequestForm } from "@/components/bookings/request-form";

export const dynamic = "force-dynamic";

export default async function RequestResourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  const admin = createAdminClient();

  const { data: resource, error } = (await admin
    .from("resources")
    .select(`
      id,
      name,
      category,
      location,
      max_duration_hours,
      buffer_minutes,
      usage_rules,
      deposit_note,
      requires_supervision,
      is_active,
      availability_windows(id, day_of_week, start_time, end_time)
    `)
    .eq("id", id)
    .maybeSingle()) as { data: any; error: any };

  if (error || !resource) {
    notFound();
  }

  if (!resource.is_active) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <Link
            href={`/resources/${resource.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to {resource.name}</span>
          </Link>
          <div className="p-8 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
            <h2 className="text-lg font-bold text-white">Resource Inactive</h2>
            <p className="text-sm text-slate-300">
              This campus facility is currently deactivated by faculty custodians and cannot accept new reservations.
            </p>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <Link
            href={`/resources/${resource.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to {resource.name}</span>
          </Link>
        </div>

        <div className="border-b border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <CalendarClock className="w-6 h-6 text-indigo-400" />
              <span>Reserve: {resource.name}</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Select date and time slot. System verifies prerequisite safety credentials and schedule conflicts in real time.
            </p>
          </div>
        </div>

        <RequestForm
          resource={{
            id: resource.id,
            name: resource.name,
            category: resource.category,
            location: resource.location,
            max_duration_hours: resource.max_duration_hours,
            buffer_minutes: resource.buffer_minutes,
            usage_rules: resource.usage_rules,
            deposit_note: resource.deposit_note,
            requires_supervision: resource.requires_supervision,
            availability_windows: resource.availability_windows || [],
          }}
        />
      </div>
    </AuthenticatedLayout>
  );
}
