import React, { Suspense } from "react";
import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import { requireUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { expireOutdatedCredentials, getDistinctCredentialTypes } from "@/lib/credentials";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { CredentialList, UserCredentialItem } from "@/components/profile/credential-list";
import { CredentialUploadForm } from "@/components/profile/credential-upload-form";
import { UserCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await requireUser();
  await expireOutdatedCredentials();
  const admin = createAdminClient();

  // 1. Fetch user's credentials
  const { data: userCredentials } = await admin
    .from("credentials")
    .select(`
      id,
      credential_type,
      file_path,
      status,
      verified_by,
      verified_at,
      expires_at,
      note,
      created_at
    `)
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  // 2. Fetch distinct credential types required across campus
  const availableTypes = await getDistinctCredentialTypes();

  const credentials: UserCredentialItem[] = (userCredentials || []) as UserCredentialItem[];

  return (
    <AuthenticatedLayout>
      <div className="space-y-6 max-w-5xl">
        <div className="border-b border-slate-800 pb-5">
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <UserCheck className="w-6 h-6 text-indigo-400" />
            <span>My Profile &amp; Credentials</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your campus affiliation, view your reliability standing, and upload safety induction certificates.
          </p>
        </div>

        {/* 1. Profile Details & Reliability Record */}
        <ProfileEditor
          initialProfile={{
            id: session.profile.id,
            email: session.user.email || "",
            full_name: session.profile.full_name,
            role: session.role,
            department: session.profile.department,
            strikes: session.profile.strikes,
            owner_verified: session.profile.owner_verified,
          }}
        />

        {/* 2. Credentials Section */}
        <CredentialList credentials={credentials} />

        {/* 3. Upload Credential Form (Wrapped in Suspense for useSearchParams) */}
        <Suspense fallback={<div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse" />}>
          <CredentialUploadForm availableTypes={availableTypes} />
        </Suspense>
      </div>
    </AuthenticatedLayout>
  );
}
