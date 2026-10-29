import { requireUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import {
  Compass,
  CalendarCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await requireUser();
  const userName = session.profile.full_name || "Colleague";

  return (
    <AuthenticatedLayout>
      <div className="space-y-8 animate-in fade-in duration-150">
        {/* Welcome Banner */}
        <section className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="space-y-3 relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-medium text-indigo-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Welcome back, {session.role.toUpperCase()}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Hello, {userName}
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Welcome to your LabLoop dashboard. From here, you can browse verified campus labs,
              request equipment reservations, track safety credentials, and coordinate resource handovers.
            </p>
          </div>
        </section>

        {/* Quick Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <Link
            href="/resources"
            className="group p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900 transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 space-y-3"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-white group-hover:text-indigo-300 transition-colors">
                Browse Equipment
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Explore 3D printers, oscilloscopes, GPUs, camera kits, and labs available for reservation.
              </p>
            </div>
          </Link>

          {session.role === "user" ? (
            <Link
              href="/bookings"
              className="group p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900 transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 space-y-3"
            >
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold text-white group-hover:text-cyan-300 transition-colors">
                  My Bookings
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Check approval statuses, upcoming time slots, and overdue item return instructions.
                </p>
              </div>
            </Link>
          ) : (
            <Link
              href="/review-queue"
              className="group p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900 transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 space-y-3"
            >
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold text-white group-hover:text-cyan-300 transition-colors">
                  Review Queue
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Review pending equipment reservation requests from students and researchers.
                </p>
              </div>
            </Link>
          )}

          <Link
            href="/profile"
            className="group p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900 transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 space-y-3"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-white group-hover:text-emerald-300 transition-colors">
                Safety Credentials
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Verify your safety training inductions, 3D printer certifications, and active strikes.
              </p>
            </div>
          </Link>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
