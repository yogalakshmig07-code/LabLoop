import Link from "next/link";
import {
  Layers,
  ShieldCheck,
  CalendarCheck,
  FileCheck2,
  AlertTriangle,
  Database,
  ArrowRight,
  Server,
  Lock,
  Cpu,
  Clock,
  Sparkles,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                LabLoop
              </span>
              <span className="ml-2 text-xs font-mono uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Foundation v1.0
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/login"
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-200 border border-slate-800 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white shadow-md shadow-indigo-600/30 transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 space-y-20">
        <section className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Next.js 15 App Router • Supabase RLS & Storage • Server Actions</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Campus Resource-Sharing,{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              Engineered Safely.
            </span>
          </h1>

          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            LabLoop allows college faculty owners and students to safely reserve, supervise, and
            maintain laboratories, 3D printers, RF benches, GPUs, and specialized gear with
            prerequisite training verification, condition reports, and anti-overlap constraints.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <a
              href="#schema"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Explore Schema & Setup</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#demo-credentials"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-medium transition-all"
            >
              <Lock className="w-4 h-4 text-slate-400" />
              <span>Demo Accounts</span>
            </a>
          </div>
        </section>

        {/* Feature Architecture Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-lg text-white">Credential Prerequisite Engine</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Resources enforce mandatory certifications (e.g. 3D Printer Safety, Drone Pilot,
              General Induction) before any reservation can be submitted or approved.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-lg text-white">Exclusion Constraint Anti-Overlap</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Postgres btree_gist exclusion constraints strictly prohibit overlapping approved or
              checked-out bookings for the same equipment, guaranteeing zero double-booking races.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-lg text-white">Condition Reports & Auditing</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Dual-stage checkout and return condition reports track wear, grades, and photographic
              proof, logged directly into an append-only immutable audit trail.
            </p>
          </div>
        </section>

        {/* Demo Users Section */}
        <section id="demo-credentials" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <Lock className="w-6 h-6 text-indigo-400" />
                <span>Demo User Accounts</span>
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Generated automatically by <code className="text-indigo-300 font-mono">npm run seed</code> with default password{" "}
                <span className="font-mono text-emerald-400 font-semibold">Demo@1234</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                role: "Admin",
                badge: "bg-red-500/10 text-red-400 border-red-500/20",
                email: "admin@labloop.demo",
                name: "Central Admin",
                dept: "Academic Facilities",
                desc: "Full administrative visibility over all resources, disputes, and settings.",
              },
              {
                role: "Owner",
                badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
                email: "owner@labloop.demo",
                name: "Dr. Meera Iyer",
                dept: "ECE Dept",
                desc: "Verified faculty owner of the 8 campus equipment benches and labs.",
              },
              {
                role: "Manager",
                badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
                email: "manager@labloop.demo",
                name: "Arjun Lab Tech",
                dept: "Makerspace Labs",
                desc: "Assigned co-manager handling checkouts, return inspections, and approvals.",
              },
              {
                role: "Student 1",
                badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                email: "student1@labloop.demo",
                name: "Priya S",
                dept: "Computer Science",
                desc: "Fully certified student with verified 3D printer & lab induction training.",
              },
              {
                role: "Student 2",
                badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
                email: "student2@labloop.demo",
                name: "Rahul K",
                dept: "Electrical Engg",
                desc: "Pending 3D printer credential, waitlisted booking, and overdue soldering station.",
              },
              {
                role: "Student 3",
                badge: "bg-slate-500/10 text-slate-400 border-slate-500/20",
                email: "student3@labloop.demo",
                name: "Divya M",
                dept: "Mechanical Engg",
                desc: "Fresh undergraduate student with no active safety certifications yet.",
              },
            ].map((user) => (
              <div
                key={user.email}
                className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${user.badge}`}>
                    {user.role}
                  </span>
                  <span className="text-xs text-slate-500">{user.dept}</span>
                </div>
                <div>
                  <h4 className="font-semibold text-white">{user.name}</h4>
                  <p className="text-xs font-mono text-slate-400 select-all mt-0.5">{user.email}</p>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{user.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Database & Schema Section */}
        <section id="schema" className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Database Architecture</h2>
              <p className="text-sm text-slate-400">
                Defined in <code className="text-emerald-300 font-mono">supabase/schema.sql</code> and typed in{" "}
                <code className="text-emerald-300 font-mono">src/types/db.ts</code>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            {[
              { table: "profiles", desc: "User roles, departments, strike count" },
              { table: "resources", desc: "8 equipment/lab items, buffer times, rules" },
              { table: "resource_requirements", desc: "Prerequisite credential ties" },
              { table: "availability_windows", desc: "Operating hours Mon-Sat 9-17" },
              { table: "credentials", desc: "Student certifications & expirations" },
              { table: "bookings", desc: "GIST exclusion non-overlap reservations" },
              { table: "condition_reports", desc: "Checkout/return grading & checklists" },
              { table: "incidents", desc: "Damage/delay reports & strike resolutions" },
              { table: "notifications", desc: "Real-time user alerts & update-own RLS" },
              { table: "audit_log", desc: "Append-only immutable event timeline" },
              { table: "fairness_settings", desc: "Campus quotas & strike limit configs" },
              { table: "resource_managers", desc: "Co-management delegations" },
            ].map((item) => (
              <div
                key={item.table}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1"
              >
                <div className="text-indigo-400 font-bold">{item.table}</div>
                <div className="text-slate-400 text-[11px] font-sans">{item.desc}</div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 mt-20 py-8 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500">
          LabLoop Platform Foundation • Next.js 15 App Router • Supabase SSR
        </div>
      </footer>
    </div>
  );
}

