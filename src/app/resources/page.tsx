import { requireUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import { ResourceBrowser, ResourceBrowseItem } from "@/components/resources/resource-browser";

export default async function ResourcesPage() {
  const session = await requireUser();
  const admin = createAdminClient();

  // 1. Fetch all active resources with relations
  const { data: rawResources, error } = await admin
    .from("resources")
    .select(`
      id,
      name,
      category,
      location,
      description,
      image_path,
      is_active,
      requires_supervision,
      max_duration_hours,
      buffer_minutes,
      owner_id,
      profiles!owner_id(full_name, department),
      resource_requirements(credential_type),
      availability_windows(day_of_week, start_time, end_time),
      bookings(start_at, end_at, status)
    `)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching resources:", error.message);
  }

  // 2. Fetch logged-in user's credentials
  const { data: userCredentials } = await admin
    .from("credentials")
    .select("credential_type, status, expires_at")
    .eq("user_id", session.user.id);

  const today = new Date().toISOString().split("T")[0];
  const credMap = new Map<string, { status: string; expires_at: string | null }>();
  userCredentials?.forEach((c) => {
    credMap.set(c.credential_type, { status: c.status, expires_at: c.expires_at });
  });

  // 3. Transform resources with personalised eligibility badges
  const resources: ResourceBrowseItem[] = (rawResources || []).map((r: any) => {
    const reqs: Array<{ credential_type: string }> = r.resource_requirements || [];
    let eligibilityStatus: "eligible" | "missing" | "pending" = "eligible";
    let eligibilityLabel = "Eligible";
    let missingName: string | undefined = undefined;

    if (reqs.length > 0) {
      let foundMissing = false;
      let foundPending = false;

      for (const req of reqs) {
        const userCred = credMap.get(req.credential_type);
        if (!userCred) {
          foundMissing = true;
          missingName = req.credential_type;
          break;
        }
        if (userCred.status === "pending") {
          foundPending = true;
        } else if (userCred.status === "verified") {
          if (userCred.expires_at && userCred.expires_at < today) {
            foundMissing = true;
            missingName = `${req.credential_type} (Expired)`;
            break;
          }
        } else {
          foundMissing = true;
          missingName = req.credential_type;
          break;
        }
      }

      if (foundMissing) {
        eligibilityStatus = "missing";
        eligibilityLabel = `Missing: ${missingName}`;
      } else if (foundPending) {
        eligibilityStatus = "pending";
        eligibilityLabel = "Pending verification";
      } else {
        eligibilityStatus = "eligible";
        eligibilityLabel = "Eligible";
      }
    }

    const approvedBookings = (r.bookings || [])
      .filter((b: any) => b.status === "approved" || b.status === "checked_out")
      .map((b: any) => ({
        start_at: b.start_at,
        end_at: b.end_at,
      }));

    return {
      id: r.id,
      name: r.name,
      category: r.category,
      location: r.location,
      description: r.description,
      image_path: r.image_path,
      is_active: r.is_active,
      requires_supervision: r.requires_supervision,
      max_duration_hours: r.max_duration_hours,
      buffer_minutes: r.buffer_minutes,
      owner_name: r.profiles?.full_name || null,
      owner_department: r.profiles?.department || null,
      requirements: reqs,
      availability: r.availability_windows || [],
      approved_bookings: approvedBookings,
      eligibility: {
        status: eligibilityStatus,
        label: eligibilityLabel,
        requirementName: missingName,
      },
    };
  });

  return (
    <AuthenticatedLayout>
      <ResourceBrowser initialResources={resources} />
    </AuthenticatedLayout>
  );
}
