import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import { ReviewQueuePanel, BookingCardData } from "@/components/review/review-queue-panel";
import { getFairnessSettings } from "@/lib/bookings";
import { detectSuspiciousUsagePatterns } from "@/lib/incidents";
import { ClipboardCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage() {
  const session = await requireRole(["owner", "manager", "admin"]);
  const admin = createAdminClient();

  // 1. Determine which resources viewer can manage
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
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-5">
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
                <ClipboardCheck className="w-6 h-6 text-indigo-400" />
                <span>Reservation Review Queue</span>
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

  // 2. Query bookings
  let query = admin
    .from("bookings")
    .select(`
      id,
      status,
      priority_tier,
      purpose,
      start_at,
      end_at,
      created_at,
      decision_reason,
      system_check,
      waitlist_rank,
      ext_requested_end_at,
      ext_status,
      resource:resources(id, name, category, location, buffer_minutes),
      user:profiles(id, full_name, email, department, strikes)
    `);

  if (resourceIds !== null) {
    query = query.in("resource_id", resourceIds);
  }

  const { data: allBookings, error } = (await query.order("created_at", { ascending: false })) as {
    data: any;
    error: any;
  };

  const rawList: any[] = allBookings || [];

  const fairnessSettings = await getFairnessSettings();
  const strikeThreshold = fairnessSettings?.strike_threshold || 3;

  // Precompute suspicious usage patterns for users in the review queue
  const patternMap = new Map<string, string[]>();
  for (const b of rawList) {
    const userId = b.user?.id;
    const resId = b.resource?.id;
    if (userId) {
      const key = `${userId}_${resId || ""}`;
      if (!patternMap.has(key)) {
        const result = await detectSuspiciousUsagePatterns(userId, resId);
        patternMap.set(key, result.chips);
      }
    }
  }

  const mapToCardData = (b: any): BookingCardData => ({
    id: b.id,
    status: b.status,
    priority_tier: b.priority_tier,
    purpose: b.purpose,
    start_at: b.start_at,
    end_at: b.end_at,
    created_at: b.created_at,
    decision_reason: b.decision_reason,
    system_check: b.system_check,
    waitlist_rank: b.waitlist_rank ? Number(b.waitlist_rank) : null,
    resource: {
      id: b.resource?.id || "",
      name: b.resource?.name || "Resource",
      category: b.resource?.category || "lab",
      location: b.resource?.location || null,
      buffer_minutes: b.resource?.buffer_minutes || 0,
    },
    user: {
      id: b.user?.id || "",
      full_name: b.user?.full_name || null,
      email: b.user?.email || null,
      department: b.user?.department || null,
      strikes: b.user?.strikes || 0,
    },
    ext_requested_end_at: b.ext_requested_end_at,
    suspicious_patterns: patternMap.get(`${b.user?.id}_${b.resource?.id || ""}`) || [],
    strike_threshold: strikeThreshold,
  });

  const pendingBookings: BookingCardData[] = rawList
    .filter((b) => b.status === "pending_review")
    .map(mapToCardData);

  const waitlistedBookings: BookingCardData[] = rawList
    .filter((b) => b.status === "waitlisted")
    .map(mapToCardData)
    .sort((a, b) => (a.waitlist_rank || 999) - (b.waitlist_rank || 999));

  const extensionBookings: BookingCardData[] = rawList
    .filter((b) => b.status === "checked_out" && b.ext_status === "pending")
    .map(mapToCardData);

  return (
    <AuthenticatedLayout allowedRoles={["owner", "manager", "admin"]}>
      <div className="space-y-6">
        <div className="border-b border-slate-800 pb-5">
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ClipboardCheck className="w-6 h-6 text-indigo-400" />
            <span>Reservation Review Queue</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Review incoming requests, manage priority waitlists, and approve session extension requests.
          </p>
        </div>

        <ReviewQueuePanel
          pendingBookings={pendingBookings}
          waitlistedBookings={waitlistedBookings}
          extensionBookings={extensionBookings}
          viewerRole={session.role}
          viewerId={session.user.id}
        />
      </div>
    </AuthenticatedLayout>
  );
}
