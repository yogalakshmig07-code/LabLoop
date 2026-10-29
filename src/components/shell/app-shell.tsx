"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRole, Notification } from "@/types/db";
import { NotificationBell } from "./notification-bell";
import { logoutAction } from "@/actions/auth";
import {
  LayoutDashboard,
  Compass,
  CalendarClock,
  UserCheck,
  PackageCheck,
  ClipboardCheck,
  ArrowLeftRight,
  AlertTriangle,
  Award,
  ScrollText,
  Scale,
  Users,
  Menu,
  X,
  LogOut,
  Layers,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface AppShellProps {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    department?: string | null;
  };
  notifications: Notification[];
  unreadCount: number;
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function AppShell({
  user,
  notifications,
  unreadCount,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Define sidebar navigation items filtered according to user role
  const getNavItems = (role: UserRole): NavItem[] => {
    const items: NavItem[] = [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Browse Resources", href: "/resources", icon: Compass },
    ];

    if (role === "user") {
      items.push(
        { label: "My Bookings", href: "/bookings", icon: CalendarClock },
        { label: "My Profile & Credentials", href: "/profile", icon: UserCheck }
      );
    } else if (role === "owner" || role === "manager") {
      if (role === "owner") {
        items.push({ label: "My Resources", href: "/my-resources", icon: PackageCheck });
      }
      items.push(
        { label: "Review Queue", href: "/review-queue", icon: ClipboardCheck },
        { label: "Active Handovers", href: "/handovers", icon: ArrowLeftRight },
        { label: "Incidents", href: "/incidents", icon: AlertTriangle },
        { label: "Credential Verification", href: "/verification", icon: Award }
      );
    } else if (role === "admin") {
      items.push(
        { label: "My Resources", href: "/my-resources", icon: PackageCheck },
        { label: "Review Queue", href: "/review-queue", icon: ClipboardCheck },
        { label: "Active Handovers", href: "/handovers", icon: ArrowLeftRight },
        { label: "Incidents", href: "/incidents", icon: AlertTriangle },
        { label: "Credential Verification", href: "/verification", icon: Award },
        { label: "Audit Log", href: "/audit-log", icon: ScrollText },
        { label: "Fairness Settings", href: "/fairness-settings", icon: Scale },
        { label: "Users", href: "/admin/users", icon: Users },
        { label: "My Bookings", href: "/bookings", icon: CalendarClock },
        { label: "My Profile & Credentials", href: "/profile", icon: UserCheck }
      );
    }

    return items;
  };

  const navItems = getNavItems(user.role);

  const getRoleBadgeClasses = (role: UserRole) => {
    switch (role) {
      case "admin":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "owner":
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
      case "manager":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      case "user":
      default:
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    }
  };

  const currentNav = navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar: Desktop + Mobile Drawer */}
      <aside
        className={`fixed md:sticky top-0 z-50 h-screen w-64 bg-slate-900/95 border-r border-slate-800/80 flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800/80">
          <Link
            href="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg p-1"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-white tracking-tight">LabLoop</span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close sidebar"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="p-4 mx-3 my-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-200 truncate">{user.name}</span>
            <span
              className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full border ${getRoleBadgeClasses(
                user.role
              )}`}
            >
              {user.role}
            </span>
          </div>
          <p className="text-[11px] font-mono text-slate-400 truncate">{user.email}</p>
          {user.department && (
            <p className="text-[11px] text-slate-500 truncate">{user.department}</p>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sign Out Button */}
        <div className="p-3 border-t border-slate-800/80">
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Sign Out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-16 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open sidebar menu"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors md:hidden focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb / Title */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 hidden sm:inline">LabLoop</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-700 hidden sm:inline" />
              <span className="font-semibold text-slate-200">
                {currentNav?.label || "Workspace"}
              </span>
            </div>
          </div>

          {/* Right Topbar actions */}
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <NotificationBell
              initialNotifications={notifications}
              initialUnreadCount={unreadCount}
            />

            {/* User Avatar Pill */}
            <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-slate-800">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 font-bold text-xs flex items-center justify-center border border-indigo-500/30">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="text-left">
                <div className="text-xs font-semibold text-slate-200 leading-none">{user.name}</div>
                <div className="text-[10px] text-slate-500 capitalize">{user.role}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

