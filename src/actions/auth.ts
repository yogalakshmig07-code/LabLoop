"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionResult } from "@/types/actions";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function loginAction(
  formData: FormData
): Promise<ActionResult<{ redirectTo: string }>> {
  const email = formData.get("email")?.toString().trim();
  const password = formData.get("password")?.toString();

  if (!email || !password) {
    return { ok: false, error: "Please provide both email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true, data: { redirectTo: "/dashboard" } };
}

export async function signupAction(
  formData: FormData
): Promise<ActionResult<{ redirectTo: string }>> {
  const email = formData.get("email")?.toString().trim();
  const password = formData.get("password")?.toString();
  const fullName = formData.get("fullName")?.toString().trim();
  const department = formData.get("department")?.toString().trim();

  if (!email || !password) {
    return { ok: false, error: "Email and password are required." };
  }
  if (!fullName) {
    return { ok: false, error: "Full name is required." };
  }
  if (!department) {
    return { ok: false, error: "Department is required." };
  }
  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        department,
        role: "user",
        owner_verified: false,
      },
    },
  });

  if (authError) {
    return { ok: false, error: authError.message };
  }

  // Ensure profile row exists in public.profiles table
  if (authData.user) {
    try {
      const admin = createAdminClient();
      await admin.from("profiles").upsert({
        id: authData.user.id,
        full_name: fullName,
        email,
        department,
        role: "user",
        owner_verified: false,
        strikes: 0,
      });
    } catch (err) {
      console.warn("Could not upsert profile during signup:", err);
    }
  }

  revalidatePath("/", "layout");
  return { ok: true, data: { redirectTo: "/dashboard" } };
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

