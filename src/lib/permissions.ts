import "server-only";
import { CurrentUserSession } from "./session";
import { createAdminClient } from "./supabase/admin";

export interface ResourceRef {
  id: string;
  owner_id: string;
}

export interface BookingRef {
  id: string;
  resource_id: string;
  user_id: string;
}

/**
 * Checks whether a user has permission to manage a resource.
 * Permissions granted to:
 * 1. Global administrators ('admin')
 * 2. Resource owner ('owner_id' matches user)
 * 3. Assigned resource managers (via 'resource_managers' table)
 */
export async function canManageResource(
  session: CurrentUserSession,
  resource: ResourceRef
): Promise<boolean> {
  if (session.role === "admin") {
    return true;
  }

  if (resource.owner_id === session.user.id) {
    return true;
  }

  const admin = createAdminClient();
  const { data: managerRecord } = await admin
    .from("resource_managers")
    .select("resource_id")
    .eq("resource_id", resource.id)
    .eq("user_id", session.user.id)
    .maybeSingle();

  return Boolean(managerRecord);
}

/**
 * Checks whether a user has permission to view a booking.
 * Permissions granted to:
 * 1. Global administrators ('admin')
 * 2. The booking applicant ('user_id' matches user)
 * 3. Anyone with resource management permissions for the booked resource
 */
export async function canViewBooking(
  session: CurrentUserSession,
  booking: BookingRef
): Promise<boolean> {
  if (session.role === "admin") {
    return true;
  }

  if (booking.user_id === session.user.id) {
    return true;
  }

  const admin = createAdminClient();
  const { data: resource } = await admin
    .from("resources")
    .select("id, owner_id")
    .eq("id", booking.resource_id)
    .maybeSingle();

  if (!resource) {
    return false;
  }

  return canManageResource(session, resource);
}

