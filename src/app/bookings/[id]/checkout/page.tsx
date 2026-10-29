import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { CheckoutForm, CheckoutBookingData } from "@/components/handovers/checkout-form";

export const dynamic = "force-dynamic";

export default async function BookingCheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireRole(["owner", "manager", "admin"]);
  const admin = createAdminClient();

  const { data: booking, error } = (await admin
    .from("bookings")
    .select(`
      id,
      status,
      start_at,
      end_at,
      purpose,
      resource:resources(id, name, category, location, owner_id),
      user:profiles!user_id(id, full_name, email, department)
    `)
    .eq("id", id)
    .maybeSingle()) as { data: any; error: any };

  if (error || !booking) {
    notFound();
  }

  // Verify permission
  const resourceData = booking.resource;
  let canManage = session.role === "admin" || resourceData?.owner_id === session.user.id;

  if (!canManage) {
    const { data: managerRow } = await admin
      .from("resource_managers")
      .select("resource_id")
      .eq("resource_id", resourceData?.id)
      .eq("user_id", session.user.id)
      .maybeSingle();
    canManage = Boolean(managerRow);
  }

  if (!canManage) {
    redirect("/handovers");
  }

  // Grace window calculation: [start_at - 30m, end_at]
  const now = new Date();
  const startAt = new Date(booking.start_at);
  const endAt = new Date(booking.end_at);
  const earliestCheckout = new Date(startAt.getTime() - 30 * 60 * 1000);
  const isWithinGraceWindow = now >= earliestCheckout && now <= endAt;

  const bookingData: CheckoutBookingData = {
    id: booking.id,
    start_at: booking.start_at,
    end_at: booking.end_at,
    purpose: booking.purpose,
    resource: {
      id: resourceData?.id || "",
      name: resourceData?.name || "Equipment",
      category: resourceData?.category || "equipment",
      location: resourceData?.location || null,
    },
    user: {
      id: booking.user?.id || "",
      full_name: booking.user?.full_name || null,
      email: booking.user?.email || null,
      department: booking.user?.department || null,
    },
  };

  return (
    <AuthenticatedLayout allowedRoles={["owner", "manager", "admin"]}>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <Link
            href="/handovers"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Handover Desk</span>
          </Link>
        </div>

        <div className="border-b border-slate-800 pb-5">
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <span>Check-Out Inspection Form</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Conduct initial physical inspection with the student present, verify equipment condition, and capture baseline photos.
          </p>
        </div>

        <CheckoutForm
          booking={bookingData}
          isWithinGraceWindow={isWithinGraceWindow}
          earliestTimeFormatted={format(earliestCheckout, "h:mm a (MMM d)")}
          endTimeFormatted={format(endAt, "h:mm a (MMM d)")}
        />
      </div>
    </AuthenticatedLayout>
  );
}

