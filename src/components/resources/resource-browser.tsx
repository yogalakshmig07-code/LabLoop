"use client";

import React, { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Compass,
  Search,
  Filter,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Clock,
  MapPin,
  Eye,
  Calendar,
  ArrowUpDown,
  RotateCcw,
  Cpu,
  Video,
  Monitor,
  Wrench,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Building,
} from "lucide-react";
import { ResourceCategory } from "@/types/db";
import { smartMatchAction } from "@/actions/resources";
import { SmartMatchResult } from "@/lib/ai/gemini";

export interface ResourceBrowseItem {
  id: string;
  name: string;
  category: ResourceCategory;
  location: string | null;
  description: string | null;
  image_path: string | null;
  is_active: boolean;
  requires_supervision: boolean;
  max_duration_hours: number;
  buffer_minutes: number;
  owner_name?: string | null;
  owner_department?: string | null;
  requirements: Array<{ credential_type: string }>;
  availability: Array<{ day_of_week: number; start_time: string; end_time: string }>;
  approved_bookings: Array<{ start_at: string; end_at: string }>;
  eligibility: {
    status: "eligible" | "missing" | "pending";
    label: string;
    requirementName?: string;
  };
}

interface ResourceBrowserProps {
  initialResources: ResourceBrowseItem[];
}

export function ResourceBrowser({ initialResources }: ResourceBrowserProps) {
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [onlyEligible, setOnlyEligible] = useState(false);
  const [dateFilter, setDateFilter] = useState("");
  const [sortBy, setSortBy] = useState<"recommended" | "name_asc" | "duration_desc" | "duration_asc">("recommended");

  // AI Smart Match
  const [smartQuery, setSmartQuery] = useState("");
  const [smartMatches, setSmartMatches] = useState<SmartMatchResult[] | null>(null);
  const [isSmartMatching, startSmartMatch] = useTransition();

  // Extract unique locations
  const locations = useMemo(() => {
    const locSet = new Set<string>();
    initialResources.forEach((r) => {
      if (r.location) locSet.add(r.location);
    });
    return Array.from(locSet).sort();
  }, [initialResources]);

  const handleSmartMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!smartQuery.trim()) return;

    startSmartMatch(async () => {
      const res = await smartMatchAction(smartQuery);
      if (res.ok) {
        setSmartMatches(res.data);
      } else {
        setSmartMatches([]);
      }
    });
  };

  const clearSmartMatch = () => {
    setSmartMatches(null);
    setSmartQuery("");
  };

  // Helper map for AI matched reasons & scores
  const matchMap = useMemo(() => {
    if (!smartMatches) return null;
    const map = new Map<string, SmartMatchResult>();
    smartMatches.forEach((m) => map.set(m.id, m));
    return map;
  }, [smartMatches]);

  // Filtered & Sorted Resources
  const filteredResources = useMemo(() => {
    let list = [...initialResources];

    // If AI Smart Match is active, prioritize or filter to matches
    if (matchMap && matchMap.size > 0) {
      list = list.filter((r) => matchMap.has(r.id));
      list.sort((a, b) => {
        const scoreA = matchMap.get(a.id)?.score || 0;
        const scoreB = matchMap.get(b.id)?.score || 0;
        return scoreB - scoreA;
      });
      return list;
    }

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.description && r.description.toLowerCase().includes(q)) ||
          (r.location && r.location.toLowerCase().includes(q)) ||
          r.category.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (selectedCategory !== "all") {
      list = list.filter((r) => r.category === selectedCategory);
    }

    // Location filter
    if (selectedLocation !== "all") {
      list = list.filter((r) => r.location === selectedLocation);
    }

    // Only eligible for me
    if (onlyEligible) {
      list = list.filter((r) => r.eligibility.status === "eligible");
    }

    // Available on date filter
    if (dateFilter) {
      const targetDate = new Date(`${dateFilter}T00:00:00`);
      const dayOfWeek = targetDate.getDay(); // 0 is Sunday, 1 is Monday...

      list = list.filter((r) => {
        // 1. Check if resource operates on this day of week
        const windowForDay = r.availability.find((w) => w.day_of_week === dayOfWeek);
        if (!windowForDay) return false;

        // 2. Check if approved bookings fully cover operating window on that date
        const windowStart = new Date(`${dateFilter}T${windowForDay.start_time}`);
        const windowEnd = new Date(`${dateFilter}T${windowForDay.end_time}`);

        const dayBookings = r.approved_bookings.filter((b) => {
          const bStart = new Date(b.start_at);
          const bEnd = new Date(b.end_at);
          return bStart < windowEnd && bEnd > windowStart;
        });

        // If there's an approved booking that overlaps the entire operating window, exclude it
        const fullyBooked = dayBookings.some((b) => {
          const bStart = new Date(b.start_at);
          const bEnd = new Date(b.end_at);
          return bStart <= windowStart && bEnd >= windowEnd;
        });

        return !fullyBooked;
      });
    }

    // Sorting
    if (sortBy === "name_asc") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "duration_desc") {
      list.sort((a, b) => b.max_duration_hours - a.max_duration_hours);
    } else if (sortBy === "duration_asc") {
      list.sort((a, b) => a.max_duration_hours - b.max_duration_hours);
    }

    return list;
  }, [
    initialResources,
    matchMap,
    searchQuery,
    selectedCategory,
    selectedLocation,
    onlyEligible,
    dateFilter,
    sortBy,
  ]);

  const getCategoryIcon = (cat: ResourceCategory) => {
    switch (cat) {
      case "lab":
        return <Wrench className="w-4 h-4" />;
      case "computing":
        return <Cpu className="w-4 h-4" />;
      case "media":
        return <Video className="w-4 h-4" />;
      case "room":
        return <Building className="w-4 h-4" />;
      case "equipment":
      default:
        return <Monitor className="w-4 h-4" />;
    }
  };

  const resetAllFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedLocation("all");
    setOnlyEligible(false);
    setDateFilter("");
    setSortBy("recommended");
    clearSmartMatch();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Compass className="w-7 h-7 text-indigo-400" />
            <span>Campus Resources</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Browse labs, fabrication tools, test benches, and media equipment with live prerequisite eligibility.
          </p>
        </div>
      </div>

      {/* AI Smart Match Box */}
      <section className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-indigo-950/50 via-slate-900 to-indigo-950/30 border border-indigo-500/30 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-semibold text-sm text-white">Smart Match</span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              AI Powered
            </span>
          </div>
          {matchMap && (
            <button
              type="button"
              onClick={clearSmartMatch}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 focus:outline-none focus:underline"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear smart match</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSmartMatch} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <input
              type="text"
              value={smartQuery}
              onChange={(e) => setSmartQuery(e.target.value)}
              placeholder="e.g. record a 4K video on Saturday for 2 hours, or solder SMD circuit board"
              className="w-full pl-4 pr-10 py-3 rounded-xl bg-slate-950/90 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors shadow-inner"
            />
          </div>
          <button
            type="submit"
            disabled={isSmartMatching || !smartQuery.trim()}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:cursor-not-allowed text-white font-medium text-sm shadow-lg shadow-indigo-600/30 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0"
          >
            {isSmartMatching ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Thinking...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Find Best Match</span>
              </>
            )}
          </button>
        </form>

        {/* Quick prompt suggestions */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 text-[11px]">Try:</span>
          {[
            "3D print robot parts",
            "Film documentary 4K",
            "Deep learning RTX 4090",
            "Electronics oscilloscope",
          ].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => {
                setSmartQuery(prompt);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-[11px] transition-colors"
            >
              &quot;{prompt}&quot;
            </button>
          ))}
        </div>

        {matchMap && (
          <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/20 text-xs text-indigo-300 flex items-center justify-between">
            <span>
              Showing {filteredResources.length} suggested match(es) for &quot;{smartQuery}&quot;. Advisory only.
            </span>
            <span className="text-[10px] font-mono uppercase bg-indigo-500/20 px-2 py-0.5 rounded text-indigo-300">
              AI-suggested
            </span>
          </div>
        )}
      </section>

      {/* Filter and Search Bar */}
      <section className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Keyword Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, spec..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 capitalize"
            >
              <option value="all">All Categories</option>
              <option value="equipment">Equipment</option>
              <option value="lab">Lab Bench</option>
              <option value="computing">Computing</option>
              <option value="media">Media &amp; Film</option>
              <option value="room">Rooms &amp; Halls</option>
            </select>
          </div>

          {/* Location Filter */}
          <div className="relative">
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 truncate"
            >
              <option value="all">All Locations</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Availability Date Filter */}
          <div className="relative">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label="Filter available date"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Second Row: Eligibility Checkbox, Sorting, and Reset */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800/60 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
            <input
              type="checkbox"
              checked={onlyEligible}
              onChange={(e) => setOnlyEligible(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-700 focus:ring-indigo-500 focus:ring-offset-slate-900"
            />
            <span className="font-medium">Only resources I am eligible to book</span>
          </label>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-slate-400">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="recommended">Recommended</option>
                <option value="name_asc">Name (A-Z)</option>
                <option value="duration_desc">Max Duration (Longest)</option>
                <option value="duration_asc">Max Duration (Shortest)</option>
              </select>
            </div>

            {(searchQuery || selectedCategory !== "all" || selectedLocation !== "all" || onlyEligible || dateFilter || matchMap) && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 focus:outline-none focus:underline"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Resource Cards Grid */}
      <section>
        {filteredResources.length === 0 ? (
          <div className="py-16 text-center rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-slate-800/60 text-slate-400 flex items-center justify-center mx-auto">
              <Compass className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white">No resources matched your criteria</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Try adjusting your search terms, changing the category or date filter, or clearing the eligibility constraint.
            </p>
            <button
              type="button"
              onClick={resetAllFilters}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset all filters</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredResources.map((res) => {
              const aiMatch = matchMap?.get(res.id);

              return (
                <div
                  key={res.id}
                  className={`rounded-2xl bg-slate-900 border transition-all flex flex-col overflow-hidden hover:border-slate-700 shadow-lg ${
                    aiMatch ? "ring-2 ring-indigo-500/50 border-indigo-500/40" : "border-slate-800"
                  }`}
                >
                  {/* Image banner or Category Placeholder */}
                  <div className="relative h-44 bg-slate-950 w-full overflow-hidden flex items-center justify-center border-b border-slate-800/80">
                    {res.image_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={res.image_path}
                        alt={res.name}
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-600">
                        <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                          {getCategoryIcon(res.category)}
                        </div>
                        <span className="text-xs capitalize font-mono text-slate-500">{res.category}</span>
                      </div>
                    )}

                    {/* Category pill */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[11px] font-medium text-slate-200">
                      {getCategoryIcon(res.category)}
                      <span className="capitalize">{res.category}</span>
                    </div>

                    {/* Supervision tag */}
                    {res.requires_supervision && (
                      <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-amber-500/20 backdrop-blur-md border border-amber-500/40 text-[10px] font-bold text-amber-300">
                        Supervision Req.
                      </div>
                    )}

                    {/* AI Score Badge if Smart Match */}
                    {aiMatch && (
                      <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-600/90 text-white text-[11px] font-bold backdrop-blur-sm shadow-md">
                        <Sparkles className="w-3 h-3" />
                        <span>AI Score {aiMatch.score}%</span>
                      </div>
                    )}
                  </div>

                  {/* Card Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-base text-white hover:text-indigo-300 transition-colors">
                          <Link href={`/resources/${res.id}`} className="focus:outline-none focus:underline">
                            {res.name}
                          </Link>
                        </h3>
                      </div>

                      {/* AI suggestion reason if present */}
                      {aiMatch && (
                        <p className="text-xs text-indigo-300 bg-indigo-950/40 p-2 rounded-xl border border-indigo-500/30 leading-relaxed font-sans">
                          💡 <span className="font-semibold">Suggested for you:</span> {aiMatch.reason}
                        </p>
                      )}

                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {res.description || "Campus lab resource available for accredited research and coursework."}
                      </p>

                      <div className="space-y-1.5 pt-2 text-xs text-slate-400">
                        {res.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="truncate">{res.location}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>Max {res.max_duration_hours}h booking ({res.buffer_minutes}m buffer)</span>
                        </div>
                      </div>
                    </div>

                    {/* Personalized Eligibility Badge & Action Button */}
                    <div className="pt-3 border-t border-slate-800/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">Eligibility:</span>
                        {res.eligibility.status === "eligible" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Eligible</span>
                          </span>
                        ) : res.eligibility.status === "pending" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Pending Verification</span>
                          </span>
                        ) : (
                          <span
                            title={res.eligibility.label}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium truncate max-w-[180px]"
                          >
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{res.eligibility.label}</span>
                          </span>
                        )}
                      </div>

                      <Link
                        href={`/resources/${res.id}`}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-800 hover:bg-indigo-600 text-white text-xs font-medium transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Details &amp; Reserve</span>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

