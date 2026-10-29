import "server-only";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { Profile, UserRole } from "@/types/db";
import { redirect } from "next/navigation";
import { User } from "@supabase/supabase-js";

export interface CurrentUserSession {
  user: User;
  profile: Profile;
  role: UserRole;
}

/**
 * Retrieves the currently authenticated user and their corresponding profile.
 * Returns null if the user is unauthenticated or has no profile.
 */
export async function getCurrentUser(): Promise<CurrentUserSession | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      // If profile hasn't been created yet, synthesize a basic one
      return {
        user,
        profile: {
          id: user.id,
          full_name: (user.user_metadata?.full_name as string) || user.email || "User",
          email: user.email || null,
          role: ((user.user_metadata?.role as UserRole) || "user"),
          department: (user.user_metadata?.department as string) || null,
          owner_verified: Boolean(user.user_metadata?.owner_verified),
          strikes: 0,
          created_at: user.created_at,
        },
        role: ((user.user_metadata?.role as UserRole) || "user"),
      };
    }

    return {
      user,
      profile,
      role: profile.role,
    };
  } catch (error: any) {
    if (error?.digest === "DYNAMIC_SERVER_USAGE" || error?.message?.includes("DYNAMIC_SERVER_USAGE")) {
      throw error;
    }
    console.error("Error retrieving current user:", error);
    return null;
  }
}

/**
 * Requires an authenticated user session. Redirects to /login if unauthenticated.
 */
export async function requireUser(): Promise<CurrentUserSession> {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/**
 * Requires the authenticated user to hold one of the specified roles.
 * Redirects to /login if unauthenticated, or to /dashboard if unauthorized.
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<CurrentUserSession> {
  const session = await requireUser();
  if (!allowedRoles.includes(session.role)) {
    redirect("/dashboard");
  }
  return session;
}

