import React from "react";
import { requireUser, requireRole } from "@/lib/session";
import { getUserNotifications } from "@/actions/notifications";
import { checkOverdueAndReminders } from "@/lib/overdue";
import { AppShell } from "./app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { UserRole } from "@/types/db";

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export async function AuthenticatedLayout({
  children,
  allowedRoles,
}: AuthenticatedLayoutProps) {
  const session = allowedRoles ? await requireRole(allowedRoles) : await requireUser();
  await checkOverdueAndReminders();
  const { notifications, unreadCount } = await getUserNotifications(8);

  const userData = {
    id: session.user.id,
    email: session.user.email || "",
    name: session.profile.full_name || session.user.email?.split("@")[0] || "User",
    role: session.role,
    department: session.profile.department,
  };

  return (
    <ToastProvider>
      <AppShell
        user={userData}
        notifications={notifications}
        unreadCount={unreadCount}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}

