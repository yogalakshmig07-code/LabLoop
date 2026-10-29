"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginAction } from "@/actions/auth";
import {
  Layers,
  Lock,
  Mail,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Check,
} from "lucide-react";

const DEMO_ACCOUNTS = [
  {
    role: "Admin",
    email: "admin@labloop.demo",
    name: "Central Admin",
    badge: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    desc: "System oversight, fairness limits & audit logs",
  },
  {
    role: "Owner",
    email: "owner@labloop.demo",
    name: "Dr. Meera Iyer",
    badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    desc: "ECE Faculty owner of 8 lab facilities",
  },
  {
    role: "Manager",
    email: "manager@labloop.demo",
    name: "Arjun Lab Tech",
    badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    desc: "Makerspace tech handling handovers & reviews",
  },
  {
    role: "Student 1",
    email: "student1@labloop.demo",
    name: "Priya S (Verified)",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    desc: "CS student with all prerequisite safety certs",
  },
  {
    role: "Student 2",
    email: "student2@labloop.demo",
    name: "Rahul K (Pending)",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    desc: "Electrical student with pending 3D cert & overdue item",
  },
  {
    role: "Student 3",
    email: "student3@labloop.demo",
    name: "Divya M (New)",
    badge: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    desc: "Mechanical student with zero certifications yet",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedDemoEmail, setSelectedDemoEmail] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleFillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("Demo@1234");
    setSelectedDemoEmail(demoEmail);
    setErrorMessage(null);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("email", email);
    formData.append("password", password);

    startTransition(async () => {
      const res = await loginAction(formData);
      if (!res.ok) {
        setErrorMessage(res.error);
      } else {
        router.push(res.data.redirectTo);
        router.refresh();
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 group focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg p-1"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">LabLoop</span>
        </Link>
        <h1 className="text-xl font-semibold text-slate-200">Sign in to your account</h1>
        <p className="text-xs text-slate-400">
          Campus lab and equipment access portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl px-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm space-y-6">
          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm"
            >
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-300 mb-1.5">
                Institutional Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@college.edu or demo email"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-medium text-slate-300">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-medium text-sm shadow-lg shadow-indigo-600/25 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 mt-2"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating...
                </span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Accounts Fill Panel */}
          <div className="border-t border-slate-800/80 pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                One-Click Demo Fill
              </span>
              <span className="text-[11px] font-mono text-slate-500">Password: Demo@1234</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => {
                const isSelected = selectedDemoEmail === acc.email;
                return (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => handleFillDemo(acc.email)}
                    className={`flex flex-col text-left p-2.5 rounded-xl border transition-all text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      isSelected
                        ? "bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/40"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border ${acc.badge}`}>
                        {acc.role}
                      </span>
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-indigo-400" />
                      ) : (
                        <span className="text-[10px] text-indigo-400 font-medium opacity-80 group-hover:opacity-100">
                          Fill
                        </span>
                      )}
                    </div>
                    <span className="font-semibold text-slate-200 truncate">{acc.name}</span>
                    <span className="text-[11px] font-mono text-slate-400 truncate">{acc.email}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-800/80 pt-4 text-center">
            <p className="text-xs text-slate-400">
              New to LabLoop?{" "}
              <Link
                href="/signup"
                className="text-indigo-400 hover:text-indigo-300 font-medium focus:outline-none focus:underline"
              >
                Create student account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

