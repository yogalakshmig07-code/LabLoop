import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import {
  Layers,
  ShieldCheck,
  CalendarCheck,
  ArrowRight,
  Lock,
  Sparkles,
  Award,
  Scale,
  ClipboardCheck,
  LogIn,
  UserPlus,
  ArrowLeftRight,
  Database,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getCurrentUser();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white flex flex-col">
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
              <span className="ml-2 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Academic Edition
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-800 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Log In</span>
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Sign Up</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 space-y-24">
        <section className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-medium text-indigo-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Campus Equipment Governance &amp; Collaborative Sharing</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Campus Resource-Sharing,{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              Engineered for Trust.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            LabLoop allows university faculty owners, lab managers, and students to safely reserve, supervise, and
            maintain laboratories, 3D printers, RF benches, GPUs, and media gear with prerequisite safety certification,
            chain-of-custody handovers, and explainable fair scheduling.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Sign In to LabLoop</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#demo-credentials"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-semibold transition-all"
            >
              <Lock className="w-4 h-4 text-slate-400" />
              <span>View Demo Accounts</span>
            </a>
          </div>
        </section>

        {/* 3 Key Trust Features Section */}
        <section className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Three Pillars of Academic Reliability
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
              How LabLoop replaces informal equipment sharing with verifiable safety and governance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            {/* Pillar 1: Verified Eligibility Engine */}
            <div className="p-7 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 transition-colors space-y-4 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-white">1. Verified Safety Eligibility</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Resources enforce mandatory prerequisite training (e.g., 3D Printer Induction, RF Laser Safety, Cleanroom Protocol) before reservation requests can proceed. Lab managers inspect and approve uploaded documents with cryptographic signed access.
              </p>
            </div>

            {/* Pillar 2: Explainable Fair Allocation */}
            <div className="p-7 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 transition-colors space-y-4 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Scale className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-white">2. Explainable Fair Allocation</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Transparent priority point scoring prioritizes coursework and research over personal projects, applies weekly category hour quotas to prevent monopolies, and factors in safety reliability strikes without arbitrary automatic bans.
              </p>
            </div>

            {/* Pillar 3: Chain-of-Custody Handovers */}
            <div className="p-7 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 transition-colors space-y-4 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ArrowLeftRight className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-white">3. Chain-of-Custody Handovers</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Dual-stage check-out and return condition inspections log equipment grades, category checklist states, and photographic evidence. An AI advisor highlights damage discrepancies, and all events stream to an immutable audit trail.
              </p>
            </div>
          </div>
        </section>

        {/* Demo Credentials Section */}
        <section id="demo-credentials" className="space-y-6 scroll-mt-20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-400" />
                <span>Pre-Configured Demo Accounts</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Populated by <code className="text-indigo-300 font-mono">npm run seed</code> with shared password{" "}
                <span className="font-mono text-emerald-400 font-bold">Demo@1234</span>
              </p>
            </div>

            <Link
              href="/login"
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <span>Go to Login page</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                role: "Central Admin",
                badge: "bg-rose-500/10 text-rose-400 border-rose-500/20",
                email: "admin@labloop.demo",
                name: "Central Admin",
                dept: "Academic Facilities",
                desc: "Full administrative governance, system fairness limits, dispute adjudication, and central audit log.",
              },
              {
                role: "Faculty Owner",
                badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
                email: "owner@labloop.demo",
                name: "Dr. Meera Iyer",
                dept: "ECE Department",
                desc: "Verified faculty owner of 8 campus benches and labs. Issues handovers, verifies credentials, and resolves damage.",
              },
              {
                role: "Lab Manager",
                badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
                email: "manager@labloop.demo",
                name: "Arjun Lab Tech",
                dept: "Makerspace Central",
                desc: "Assigned co-manager for rapid student check-outs, return condition inspections, and reservation approvals.",
              },
              {
                role: "Certified Student",
                badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                email: "student1@labloop.demo",
                name: "Priya S",
                dept: "Computer Science",
                desc: "Fully verified 3D printer and induction credentials; ready to book advanced manufacturing and GPU labs.",
              },
              {
                role: "Pending & Overdue Student",
                badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
                email: "student2@labloop.demo",
                name: "Rahul K",
                dept: "Electrical Engg",
                desc: "Has a pending credential under review, a waitlisted request, and an active overdue soldering station return.",
              },
              {
                role: "Fresh Student",
                badge: "bg-slate-500/10 text-slate-400 border-slate-500/20",
                email: "student3@labloop.demo",
                name: "Divya M",
                dept: "Mechanical Engg",
                desc: "Fresh student account with no credentials yet; ideal for evaluating prerequisite blockers and self-upload flows.",
              },
            ].map((u) => (
              <div
                key={u.email}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${u.badge}`}>
                      {u.role}
                    </span>
                    <span className="text-[11px] text-slate-500">{u.dept}</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-sm">{u.name}</h4>
                    <p className="text-xs font-mono text-indigo-300 select-all mt-0.5">{u.email}</p>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{u.desc}</p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-mono text-[11px]">Pass: Demo@1234</span>
                  <Link
                    href={`/login?email=${encodeURIComponent(u.email)}`}
                    className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                  >
                    <span>Quick Login</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-8 bg-slate-950 text-center space-y-2 text-xs text-slate-500">
        <div>
          <span className="font-medium text-slate-400">Demo environment: fictional data</span> • LabLoop Academic Platform
        </div>
        <p className="text-[11px] text-slate-600">
          Powered by Next.js 15 App Router, Supabase Postgres &amp; Storage, and Google Gemini AI Advisory.
        </p>
      </footer>
    </div>
  );
}
