"use client";

import React, { useState, useTransition } from "react";
import {
  Users,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle2,
  XCircle,
  Building2,
  Mail,
  AlertTriangle,
  Loader2,
  Filter,
  UserCheck,
} from "lucide-react";
import { updateUserRoleAction, toggleUserOwnerVerifiedAction } from "@/actions/admin-users";
import { useToast } from "@/components/ui/toast";
import { UserRole } from "@/types/db";

export interface UserProfileItem {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  department: string | null;
  owner_verified: boolean;
  strikes: number;
  created_at: string;
}

export function UserList({ initialUsers }: { initialUsers: UserProfileItem[] }) {
  const [users, setUsers] = useState<UserProfileItem[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { success, error: toastError } = useToast();

  const handleRoleChange = (userId: string, newRole: UserRole, userName: string | null) => {
    setUpdatingId(userId);
    startTransition(async () => {
      const res = await updateUserRoleAction(userId, newRole);
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
        success(`Updated ${userName || "User"}'s role to ${newRole.toUpperCase()}.`);
      } else {
        toastError(res.error || "Failed to update role.");
      }
      setUpdatingId(null);
    });
  };

  const handleToggleVerification = (userId: string, currentStatus: boolean, userName: string | null) => {
    setUpdatingId(userId);
    startTransition(async () => {
      const targetStatus = !currentStatus;
      const res = await toggleUserOwnerVerifiedAction(userId, targetStatus);
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, owner_verified: targetStatus } : u))
        );
        success(
          `${userName || "User"}'s faculty owner verification ${
            targetStatus ? "granted" : "revoked"
          }.`
        );
      } else {
        toastError(res.error || "Failed to update verification status.");
      }
      setUpdatingId(null);
    });
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.full_name?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (u.email?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (u.department?.toLowerCase() || "").includes(search.toLowerCase());

    const matchesRole = roleFilter === "all" || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const totalUsers = users.length;
  const totalOwners = users.filter((u) => u.role === "owner").length;
  const verifiedOwners = users.filter((u) => u.role === "owner" && u.owner_verified).length;
  const pendingOwners = totalOwners - verifiedOwners;

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Registered</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{totalUsers}</p>
          <span className="text-xs text-slate-500">Across campus departments</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Faculty Owners</span>
            <Shield className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{totalOwners}</p>
          <span className="text-xs text-slate-500">Resource custodian accounts</span>
        </div>

        <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-400">Verified Owners</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-300 mt-2">{verifiedOwners}</p>
          <span className="text-xs text-emerald-500/80">Authorized to publish resources</span>
        </div>

        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-400">Pending Verification</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-300 mt-2">{pendingOwners}</p>
          <span className="text-xs text-amber-500/80">Awaiting admin authorization</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, email, or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
          >
            <option value="all">All Roles</option>
            <option value="owner">Owners (Faculty)</option>
            <option value="manager">Managers (Technicians)</option>
            <option value="user">Users (Students/Staff)</option>
            <option value="admin">Administrators</option>
          </select>
        </div>
      </div>

      {/* User Directory Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-medium">
              <tr>
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">Strikes (Read-Only)</th>
                <th className="py-3.5 px-4">Owner Verification</th>
                <th className="py-3.5 px-4 text-right">Verification Toggle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No campus members found matching your filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isUpdating = updatingId === u.id && isPending;

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-indigo-300 shrink-0">
                            {(u.full_name || u.email || "U").substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-white">{u.full_name || "Unnamed"}</div>
                            <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <Mail className="w-3 h-3 text-slate-500" />
                              <span>{u.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Interactive Role Dropdown */}
                      <td className="py-4 px-4">
                        <div className="relative inline-block">
                          <select
                            disabled={isUpdating}
                            value={u.role}
                            onChange={(e) =>
                              handleRoleChange(u.id, e.target.value as UserRole, u.full_name)
                            }
                            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border cursor-pointer focus:outline-none transition-colors ${
                              u.role === "admin"
                                ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                                : u.role === "owner"
                                ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                                : u.role === "manager"
                                ? "bg-sky-500/10 text-sky-300 border-sky-500/30"
                                : "bg-slate-800 text-slate-300 border-slate-700"
                            } disabled:opacity-50`}
                          >
                            <option value="user" className="bg-slate-900 text-slate-300">
                              USER (Student/Staff)
                            </option>
                            <option value="owner" className="bg-slate-900 text-amber-300">
                              OWNER (Faculty Custodian)
                            </option>
                            <option value="manager" className="bg-slate-900 text-sky-300">
                              MANAGER (Lab Tech)
                            </option>
                            <option value="admin" className="bg-slate-900 text-rose-300">
                              ADMIN (Global)
                            </option>
                          </select>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-slate-300">
                        {u.department ? (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-500" />
                            <span>{u.department}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">None</span>
                        )}
                      </td>

                      {/* Strikes (Read-Only) */}
                      <td className="py-4 px-4">
                        {u.strikes > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 font-semibold font-mono">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {u.strikes} {u.strikes === 1 ? "strike" : "strikes"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            0 Clean
                          </span>
                        )}
                      </td>

                      {/* Owner Verification Status Badge */}
                      <td className="py-4 px-4">
                        {u.owner_verified ? (
                          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                            <XCircle className="w-3.5 h-3.5 text-slate-500" />
                            Unverified
                          </span>
                        )}
                      </td>

                      {/* Owner Verification Toggle Button */}
                      <td className="py-4 px-4 text-right">
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleToggleVerification(u.id, u.owner_verified, u.full_name)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            u.owner_verified
                              ? "bg-slate-800 text-rose-300 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/30"
                              : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {isUpdating ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Updating...</span>
                            </>
                          ) : u.owner_verified ? (
                            <>
                              <ShieldAlert className="w-3 h-3 text-rose-400" />
                              <span>Revoke Verification</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-3 h-3 text-white" />
                              <span>Verify Owner</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
