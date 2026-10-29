import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, RotateCcw } from "lucide-react";
import {
  ReturnForm,
  ReturnBookingData,
  ConditionReportData,
} from "@/components/handovers/return-form";
import { ConditionGrade, ResourceCategory } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function BookingReturnPage({
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
      checked_out_at,
      returned_at,
      resource:resources(id, name, category, location, owner_id),
      user:profiles!user_id(id, full_name, email, department)
    `)
    .eq("id", id)
    .maybeSingle()) as { data: any; error: any };

  if (error || !booking) {
    notFound();
  }

  // Authorization check
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

  // Fetch condition reports for this booking
  const { data: reports } = await admin
    .from("condition_reports")
    .select("*")
    .eq("booking_id", id)
    .order("created_at", { ascending: true });

  const rawCheckout = reports?.find((r) => r.kind === "checkout");
  const rawReturn = reports?.find((r) => r.kind === "return");

  // Generate signed URLs for private photos
  const allPhotoPaths: string[] = [
    ...(rawCheckout?.photo_paths || []),
    ...(rawReturn?.photo_paths || []),
  ];

  const photoUrlMap: Record<string, string> = {};
  for (const path of allPhotoPaths) {
    if (!path) continue;
    const { data: signed } = await admin.storage
      .from("condition-photos")
      .createSignedUrl(path, 3600);
    if (signed?.signedUrl) {
      photoUrlMap[path] = signed.signedUrl;
    }
  }

  const checkoutReport: ConditionReportData | null = rawCheckout
    ? {
        id: rawCheckout.id,
        kind: "checkout",
        grade: rawCheckout.grade as ConditionGrade,
        notes: rawCheckout.notes,
        checklist: (rawCheckout.checklist as Record<string, boolean>) || {},
        photo_paths: rawCheckout.photo_paths || [],
        photoUrls: photoUrlMap,
        created_at: rawCheckout.created_at,
      }
    : null;

  const existingReturnReport: ConditionReportData | null = rawReturn
    ? {
        id: rawReturn.id,
        kind: "return",
        grade: rawReturn.grade as ConditionGrade,
        notes: rawReturn.notes,
        checklist: (rawReturn.checklist as Record<string, boolean>) || {},
        photo_paths: rawReturn.photo_paths || [],
        photoUrls: photoUrlMap,
        created_at: rawReturn.created_at,
      }
    : null;

  const bookingData: ReturnBookingData = {
    id: booking.id,
    status: booking.status,
    start_at: booking.start_at,
    end_at: booking.end_at,
    checked_out_at: booking.checked_out_at,
    returned_at: booking.returned_at,
    resource: {
      id: resourceData?.id || "",
      name: resourceData?.name || "Equipment",
      category: (resourceData?.category || "equipment") as ResourceCategory,
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
      <div className="space-y-6 max-w-4xl mx-auto">
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
            <RotateCcw className="w-6 h-6 text-indigo-400" />
            <span>Equipment Return &amp; Condition Verification</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Compare post-session physical status against check-out baseline.
          </p>
        </div>

        <ReturnForm
          booking={bookingData}
          checkoutReport={checkoutReport}
          existingReturnReport={existingReturnReport}
        />
      </div>
    </AuthenticatedLayout>
  );
}

