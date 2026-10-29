import React from "react";

export default function Loading() {
  return (
    <div className="w-full min-h-[60vh] p-4 sm:p-6 lg:p-8 space-y-6 animate-pulse">
      {/* Top Banner Skeleton */}
      <div className="h-32 rounded-2xl bg-slate-900 border border-slate-800/80" />

      {/* Metrics Row Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="h-24 rounded-xl bg-slate-900 border border-slate-800/80" />
        <div className="h-24 rounded-xl bg-slate-900 border border-slate-800/80" />
        <div className="h-24 rounded-xl bg-slate-900 border border-slate-800/80" />
        <div className="h-24 rounded-xl bg-slate-900 border border-slate-800/80" />
      </div>

      {/* Content Columns Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-72 rounded-2xl bg-slate-900 border border-slate-800/80" />
        <div className="h-72 rounded-2xl bg-slate-900 border border-slate-800/80" />
      </div>
    </div>
  );
}

