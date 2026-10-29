import { requireUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserDashboard } from "@/components/dashboard/user-dashboard";
import { StaffDashboard, HandoverSummaryItem, ResourceUtilisationItem } from "@/components/dashboard/staff-dashboard";
import { AdminDashboard, TopFairnessUser, OpenDisputeItem, UnverifiedOwnerItem } from "@/components/dashboard/admin-dashboard";
import { subDays } from "date-fns";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireUser();
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const thirtyDaysAgoIso = subDays(new Date(), 30).toISOString();

  // =========================================================================
  // 1. ADMIN DASHBOARD
  // =========================================================================
  if (session.role === "admin") {
    // Platform Totals
    const [
      { count: usersCount },
      { count: resourcesCount },
      { count: bookingsCount },
      { count: incidentsCount },
    ] = await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin.from("resources").select("id", { count: "exact", head: true }).eq("is_active", true),
      admin.from("bookings").select("id", { count: "exact", head: true }),
      admin.from("incidents").select("id", { count: "exact", head: true }).in("status", ["open", "under_review"]),
    ]);

    // Fairness Monopolisation Snapshot (Last 30 Days)
    const { data: recentBookings } = await admin
      .from("bookings")
      .select(`
        user_id,
        start_at,
        end_at,
        user:profiles!user_id(id, full_name, email, department)
      `)
      .in("status", ["approved", "checked_out", "returned"])
      .gte("start_at", thirtyDaysAgoIso);

    const userHoursMap = new Map<
      string,
      { user: any; totalHours: number }
    >();

    (recentBookings || []).forEach((b: any) => {
      const s = new Date(b.start_at).getTime();
      const e = new Date(b.end_at).getTime();
      const hrs = Math.max(0, (e - s) / (1000 * 60 * 60));
      const existing = userHoursMap.get(b.user_id) || {
        user: b.user,
        totalHours: 0,
      };
      existing.totalHours += hrs;
      userHoursMap.set(b.user_id, existing);
    });

    const userList = Array.from(userHoursMap.values());
    const totalHoursAll = userList.reduce((acc, curr) => acc + curr.totalHours, 0);
    const platformAverage = userList.length > 0 ? Math.round((totalHoursAll / userList.length) * 10) / 10 : 0;

    userList.sort((a, b) => b.totalHours - a.totalHours);
    const top5 = userList.slice(0, 5).map((item): TopFairnessUser => {
      const hrs = Math.round(item.totalHours * 10) / 10;
      const ratio = platformAverage > 0 ? Math.round((hrs / platformAverage) * 10) / 10 : 1;
      let riskLevel: "low" | "moderate" | "high" = "low";
      if (ratio >= 2.5 && hrs >= 15) riskLevel = "high";
      else if (ratio >= 1.5 && hrs >= 8) riskLevel = "moderate";

      return {
        id: item.user?.id || "",
        name: item.user?.full_name || "Campus Colleague",
        email: item.user?.email || "user@campus.edu",
        department: item.user?.department || null,
        hoursBooked30Days: hrs,
        ratioToAverage: ratio,
        riskLevel,
      };
    });

    // Open Disputes
    const { data: disputesData } = await admin
      .from("incidents")
      .select(`
        id,
        booking_id,
        incident_type,
        dispute_note,
        created_at,
        booking:bookings!booking_id(
          resource:resources(name),
          user:profiles!user_id(full_name)
        )
      `)
      .eq("status", "disputed")
      .order("created_at", { ascending: false });

    const openDisputes: OpenDisputeItem[] = (disputesData || []).map((d: any) => ({
      id: d.id,
      bookingId: d.booking_id,
      resourceName: d.booking?.resource?.name || "Equipment Item",
      userName: d.booking?.user?.full_name || "Applicant",
      type: d.incident_type,
      disputeReason: d.dispute_note || "Contested damage determination",
      createdAt: d.created_at,
    }));

    // Unverified Owners
    const { data: unverifiedOwnersData } = await admin
      .from("profiles")
      .select("id, full_name, email, department, created_at")
      .eq("role", "owner")
      .eq("owner_verified", false)
      .order("created_at", { ascending: false });

    const unverifiedOwners: UnverifiedOwnerItem[] = (unverifiedOwnersData || []).map((o: any) => ({
      id: o.id,
      name: o.full_name || "Faculty Applicant",
      email: o.email,
      department: o.department,
      createdAt: o.created_at,
    }));

    return (
      <AuthenticatedLayout allowedRoles={["admin"]}>
        <AdminDashboard
          adminName={session.profile.full_name || "Central Administrator"}
          totals={{
            totalUsers: usersCount || 0,
            activeResources: resourcesCount || 0,
            totalBookings: bookingsCount || 0,
            openIncidents: incidentsCount || 0,
          }}
          fairnessSnapshot={{
            platformAverageHours: platformAverage,
            topUsers: top5,
          }}
          openDisputes={openDisputes}
          unverifiedOwners={unverifiedOwners}
        />
      </AuthenticatedLayout>
    );
  }

  // =========================================================================
  // 2. OWNER & MANAGER DASHBOARD
  // =========================================================================
  if (session.role === "owner" || session.role === "manager") {
    // 1. Resolve managed resources
    const { data: owned } = await admin
      .from("resources")
      .select("id, name, category")
      .eq("owner_id", session.user.id);

    const { data: managed } = await admin
      .from("resource_managers")
      .select("resource_id, resources(id, name, category)")
      .eq("user_id", session.user.id);

    const resourceMap = new Map<string, { id: string; name: string; category: string }>();
    owned?.forEach((r) => resourceMap.set(r.id, r));
    managed?.forEach((m: any) => {
      if (m.resources) resourceMap.set(m.resources.id, m.resources);
    });

    const managedIds = Array.from(resourceMap.keys());
    const managedResources = Array.from(resourceMap.values());

    if (managedIds.length === 0) {
      return (
        <AuthenticatedLayout allowedRoles={["owner", "manager"]}>
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-white">Facility Operations Hub</h1>
            <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-sm">
              You are not currently designated as an owner or manager for any campus resources.
            </div>
          </div>
        </AuthenticatedLayout>
      );
    }

    // 2. Fetch required credential types for managed resources
    const { data: reqs } = await admin
      .from("resource_requirements")
      .select("credential_type")
      .in("resource_id", managedIds);

    const requiredTypes = Array.from(new Set((reqs || []).map((r) => r.credential_type)));

    // 3. Aggregate Counts
    const [
      { count: pendingCount },
      { count: waitlistedCount },
      { count: checkedOutCount },
      { count: overdueCount },
      { count: incidentsCount },
      { count: pendingCredsCount },
    ] = await Promise.all([
      admin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .in("resource_id", managedIds)
        .eq("status", "pending_review"),
      admin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .in("resource_id", managedIds)
        .eq("status", "waitlisted"),
      admin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .in("resource_id", managedIds)
        .eq("status", "checked_out"),
      admin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .in("resource_id", managedIds)
        .eq("status", "checked_out")
        .lt("end_at", nowIso),
      admin
        .from("incidents")
        .select("id, bookings!inner(resource_id)", { count: "exact", head: true })
        .in("bookings.resource_id", managedIds)
        .in("status", ["open", "under_review"]),
      requiredTypes.length > 0
        ? admin
            .from("credentials")
            .select("id", { count: "exact", head: true })
            .in("type", requiredTypes)
            .eq("status", "pending")
        : Promise.resolve({ count: 0 }),
    ]);

    // 4. Next 5 handovers
    const [{ data: approvedHandovers }, { data: checkedOutHandovers }] = await Promise.all([
      admin
        .from("bookings")
        .select(`
          id,
          status,
          start_at,
          end_at,
          resource:resources(name),
          user:profiles!user_id(full_name, department)
        `)
        .in("resource_id", managedIds)
        .eq("status", "approved")
        .order("start_at", { ascending: true })
        .limit(5),
      admin
        .from("bookings")
        .select(`
          id,
          status,
          start_at,
          end_at,
          resource:resources(name),
          user:profiles!user_id(full_name, department)
        `)
        .in("resource_id", managedIds)
        .eq("status", "checked_out")
        .order("end_at", { ascending: true })
        .limit(5),
    ]);

    const combinedHandovers: HandoverSummaryItem[] = [];

    (approvedHandovers || []).forEach((b: any) => {
      combinedHandovers.push({
        id: b.id,
        type: "checkout",
        resourceName: b.resource?.name || "Equipment",
        userName: b.user?.full_name || "Applicant",
        userDepartment: b.user?.department,
        time: b.start_at,
        status: b.status,
      });
    });

    (checkedOutHandovers || []).forEach((b: any) => {
      const isOverdue = new Date(b.end_at).getTime() < Date.now();
      combinedHandovers.push({
        id: b.id,
        type: "return",
        resourceName: b.resource?.name || "Equipment",
        userName: b.user?.full_name || "Applicant",
        userDepartment: b.user?.department,
        time: b.end_at,
        status: b.status,
        isOverdue,
      });
    });

    combinedHandovers.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    const next5Handovers = combinedHandovers.slice(0, 5);

    // 5. Utilisation Summary per Resource (Last 30 Days)
    const { data: usageBookings } = await admin
      .from("bookings")
      .select("resource_id, start_at, end_at")
      .in("resource_id", managedIds)
      .in("status", ["approved", "checked_out", "returned"])
      .gte("start_at", thirtyDaysAgoIso);

    const resourceUsageMap = new Map<string, { hours: number; count: number }>();
    (usageBookings || []).forEach((b: any) => {
      const s = new Date(b.start_at).getTime();
      const e = new Date(b.end_at).getTime();
      const hrs = Math.max(0, (e - s) / (1000 * 60 * 60));
      const existing = resourceUsageMap.get(b.resource_id) || { hours: 0, count: 0 };
      existing.hours += hrs;
      existing.count += 1;
      resourceUsageMap.set(b.resource_id, existing);
    });

    let maxHours = 0;
    const utilisationSummary: ResourceUtilisationItem[] = managedResources.map((res) => {
      const usage = resourceUsageMap.get(res.id) || { hours: 0, count: 0 };
      const roundedHours = Math.round(usage.hours * 10) / 10;
      if (roundedHours > maxHours) maxHours = roundedHours;
      return {
        id: res.id,
        name: res.name,
        category: res.category,
        hoursBooked30Days: roundedHours,
        percentageOfMax: 0,
        bookingsCount30Days: usage.count,
      };
    });

    const divisor = maxHours > 0 ? maxHours : 100;
    utilisationSummary.forEach((u) => {
      u.percentageOfMax = Math.round((u.hoursBooked30Days / divisor) * 100);
    });

    utilisationSummary.sort((a, b) => b.hoursBooked30Days - a.hoursBooked30Days);

    return (
      <AuthenticatedLayout allowedRoles={["owner", "manager"]}>
        <StaffDashboard
          userRole={session.role}
          userName={session.profile.full_name || "Facility Custodian"}
          counts={{
            pendingRequests: pendingCount || 0,
            waitlisted: waitlistedCount || 0,
            checkedOut: checkedOutCount || 0,
            overdue: overdueCount || 0,
            openIncidents: incidentsCount || 0,
            pendingCredentials: pendingCredsCount || 0,
          }}
          nextHandovers={next5Handovers}
          resourceUtilisation={utilisationSummary}
        />
      </AuthenticatedLayout>
    );
  }

  // =========================================================================
  // 3. USER (STUDENT / RESEARCHER) DASHBOARD
  // =========================================================================
  const [
    { data: upcomingData },
    { data: pendingData },
    { data: waitlistedData },
    { data: notifsData },
    { data: credsData },
  ] = await Promise.all([
    admin
      .from("bookings")
      .select(`
        id,
        status,
        start_at,
        end_at,
        resource:resources(id, name, category, location)
      `)
      .eq("user_id", session.user.id)
      .in("status", ["approved", "checked_out"])
      .order("start_at", { ascending: true })
      .limit(5),
    admin
      .from("bookings")
      .select(`
        id,
        status,
        start_at,
        end_at,
        purpose,
        priority_tier,
        created_at,
        resource:resources(id, name, category)
      `)
      .eq("user_id", session.user.id)
      .eq("status", "pending_review")
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("bookings")
      .select(`
        id,
        start_at,
        end_at,
        priority_tier,
        waitlist_rank,
        resource:resources(id, name, category)
      `)
      .eq("user_id", session.user.id)
      .eq("status", "waitlisted")
      .order("created_at", { ascending: false }),
    admin
      .from("notifications")
      .select("id, title, body, is_read, created_at, link")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("credentials")
      .select("id, type, status, expires_at, reviewer_notes")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false }),
  ]);

  const upcomingBookings = (upcomingData || []).map((b: any) => ({
    id: b.id,
    status: b.status,
    start_at: b.start_at,
    end_at: b.end_at,
    resource: {
      id: b.resource?.id || "",
      name: b.resource?.name || "Equipment Item",
      category: b.resource?.category || "equipment",
      location: b.resource?.location,
    },
  }));

  const pendingRequests = (pendingData || []).map((b: any) => ({
    id: b.id,
    status: b.status,
    start_at: b.start_at,
    end_at: b.end_at,
    purpose: b.purpose || "Reservation request",
    priority_tier: b.priority_tier || "coursework",
    created_at: b.created_at,
    resource: {
      id: b.resource?.id || "",
      name: b.resource?.name || "Equipment Item",
      category: b.resource?.category || "equipment",
    },
  }));

  const waitlistedBookings = (waitlistedData || []).map((b: any) => ({
    id: b.id,
    start_at: b.start_at,
    end_at: b.end_at,
    priority_tier: b.priority_tier || "coursework",
    waitlist_rank: b.waitlist_rank || 1,
    resource: {
      id: b.resource?.id || "",
      name: b.resource?.name || "Equipment Item",
      category: b.resource?.category || "equipment",
    },
  }));

  const credentials = (credsData || []).map((c: any) => ({
    id: c.id,
    type: c.type,
    status: c.status,
    expires_at: c.expires_at,
    reviewer_notes: c.reviewer_notes,
  }));

  return (
    <AuthenticatedLayout allowedRoles={["user"]}>
      <UserDashboard
        user={{
          id: session.user.id,
          name: session.profile.full_name || "Campus Colleague",
          email: session.user.email || "",
          department: session.profile.department,
          strikes: session.profile.strikes || 0,
        }}
        upcomingBookings={upcomingBookings}
        pendingRequests={pendingRequests}
        waitlistedBookings={waitlistedBookings}
        recentNotifications={notifsData || []}
        credentials={credentials}
      />
    </AuthenticatedLayout>
  );
}
