import { requireUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkEligibility } from "@/lib/eligibility";
import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Compass,
  MapPin,
  Clock,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Calendar,
  User,
  Users,
  FileText,
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  DollarSign,
  Ban,
  Wrench,
  Cpu,
  Video,
  Building,
  Monitor,
} from "lucide-react";
import { format, startOfWeek, addDays, isSameDay, isToday } from "date-fns";

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireUser();
  const admin = createAdminClient();

  // 1. Fetch resource details
  const { data: resource, error } = (await admin
    .from("resources")
    .select(`
      *,
      owner:profiles!owner_id(id, full_name, department, email),
      resource_requirements(*),
      availability_windows(*),
      resource_managers(
        user:profiles(id, full_name, email)
      )
    `)
    .eq("id", id)
    .maybeSingle()) as { data: any; error: any };

  if (error || !resource) {
    notFound();
  }

  // 2. Fetch upcoming booked slots (anonymised: only start_at, end_at, status)
  const now = new Date().toISOString();
  const { data: upcomingBookings } = await admin
    .from("bookings")
    .select("id, start_at, end_at, status")
    .eq("resource_id", id)
    .in("status", ["approved", "checked_out"])
    .gte("end_at", now)
    .order("start_at", { ascending: true })
    .limit(10);

  // 3. Compute personalized eligibility using core service
  const eligibility = await checkEligibility(session.user.id, id);

  const managers = (resource.resource_managers || [])
    .map((rm: any) => rm.user?.full_name || rm.user?.email)
    .filter(Boolean);

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "lab":
        return <Wrench className="w-5 h-5 text-indigo-400" />;
      case "computing":
        return <Cpu className="w-5 h-5 text-indigo-400" />;
      case "media":
        return <Video className="w-5 h-5 text-indigo-400" />;
      case "room":
        return <Building className="w-5 h-5 text-indigo-400" />;
      case "equipment":
      default:
        return <Monitor className="w-5 h-5 text-indigo-400" />;
    }
  };

  // 4. Generate current week days for the weekly schedule strip
  const currMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currMonday, i));

  return (
    <AuthenticatedLayout>
      <div className="space-y-8 max-w-5xl mx-auto">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href="/resources"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors focus:outline-none focus:underline"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Resource Catalog</span>
          </Link>
        </div>

        {/* Inactive notice if applicable */}
        {!resource.is_active && (
          <div
            role="alert"
            className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm"
          >
            <Ban className="w-5 h-5 text-amber-400 shrink-0" />
            <span>
              <strong>Resource Inactive:</strong> This equipment is temporarily offline or undergoing maintenance. Reservations are currently suspended.
            </span>
          </div>
        )}

        {/* Hero Section: Image + Title Details */}
        <section className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl">
          <div className="relative h-64 sm:h-80 w-full bg-slate-950 flex items-center justify-center">
            {resource.image_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resource.image_path}
                alt={resource.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-600">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                  {getCategoryIcon(resource.category)}
                </div>
                <span className="text-xs uppercase font-mono">{resource.category}</span>
              </div>
            )}

            {/* Badges Overlay */}
            <div className="absolute top-4 left-4 flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-800 text-xs font-semibold capitalize text-white flex items-center gap-1.5">
                {getCategoryIcon(resource.category)}
                <span>{resource.category}</span>
              </span>
              {resource.requires_supervision && (
                <span className="px-3 py-1 rounded-full bg-amber-500/20 backdrop-blur-md border border-amber-500/40 text-xs font-bold text-amber-300">
                  Supervision Required
                </span>
              )}
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {resource.name}
                </h1>
                {resource.location && (
                  <p className="text-sm text-slate-400 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    <span>{resource.location}</span>
                  </p>
                )}
              </div>

              {/* Request CTA */}
              <div className="shrink-0">
                {resource.is_active ? (
                  <Link
                    href={`/resources/${resource.id}/request`}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <span>Request this resource</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <button
                    disabled
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800 text-slate-500 font-medium text-sm cursor-not-allowed"
                  >
                    <Ban className="w-4 h-4" />
                    <span>Unavailable (Inactive)</span>
                  </button>
                )}
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
              {resource.description || "Campus lab resource available for research, coursework, and term prototyping."}
            </p>

            {/* Spec stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-800">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[11px] text-slate-500 font-medium">Max Duration</span>
                <p className="text-base font-bold text-white mt-0.5">{resource.max_duration_hours} Hours</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[11px] text-slate-500 font-medium">Buffer Time</span>
                <p className="text-base font-bold text-white mt-0.5">{resource.buffer_minutes} Mins</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[11px] text-slate-500 font-medium">Faculty Owner</span>
                <p className="text-xs font-semibold text-white mt-0.5 truncate">
                  {(resource.owner as any)?.full_name || "Faculty Owner"}
                </p>
                <span className="text-[10px] text-slate-500 truncate block">
                  {(resource.owner as any)?.department || "Academic Dept"}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[11px] text-slate-500 font-medium">Lab Tech Managers</span>
                <p className="text-xs font-semibold text-white mt-0.5 truncate">
                  {managers.length > 0 ? managers.join(", ") : "Main Lab Staff"}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Personalized Eligibility Check Panel */}
        <section className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Prerequisite Safety &amp; Training Check</h2>
                <p className="text-xs text-slate-400">Personalized for {session.profile.full_name || "your account"}</p>
              </div>
            </div>

            {eligibility.eligible ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>All Requirements Met</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold">
                <AlertCircle className="w-4 h-4" />
                <span>Action Needed</span>
              </span>
            )}
          </div>

          {eligibility.items.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400">
              No special safety certifications are required for this resource. All enrolled campus students and faculty are eligible to book.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80 rounded-xl bg-slate-950/60 border border-slate-800/80 overflow-hidden">
              {eligibility.items.map((item, idx) => (
                <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-white">{item.requirement}</span>
                      {item.status === "met" && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Met
                        </span>
                      )}
                      {item.status === "pending" && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          Pending Review
                        </span>
                      )}
                      {item.status === "missing" && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Missing
                        </span>
                      )}
                      {item.status === "expired" && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Expired
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{item.detail}</p>
                  </div>

                  {item.status !== "met" && (
                    <Link
                      href={`/profile?type=${encodeURIComponent(item.requirement)}#upload`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shrink-0 self-start sm:self-center"
                    >
                      <span>Upload Proof ({item.requirement})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Operating Hours & Rules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Availability Windows */}
          <section className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span>Operating Availability Windows</span>
            </h2>

            {resource.availability_windows && resource.availability_windows.length > 0 ? (
              <div className="divide-y divide-slate-800/80 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                {resource.availability_windows
                  .sort((a: any, b: any) => a.day_of_week - b.day_of_week)
                  .map((w: any) => (
                    <div key={w.id} className="p-3 flex items-center justify-between">
                      <span className="font-semibold text-slate-200">{DAYS_OF_WEEK[w.day_of_week]}</span>
                      <span className="font-mono text-slate-400">
                        {w.start_time.slice(0, 5)} - {w.end_time.slice(0, 5)}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Standard campus hours apply (Mon-Fri 09:00 - 17:00).</p>
            )}
          </section>

          {/* Usage Rules & Deposit Note */}
          <section className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Usage Rules &amp; Security Deposit</span>
            </h2>

            <div className="space-y-3 text-xs leading-relaxed">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="font-semibold text-slate-300">Mandatory Rules of Operation:</span>
                <p className="text-slate-400">
                  {resource.usage_rules || "Follow general lab safety guidelines and maintain clean workbench after session."}
                </p>
              </div>

              {resource.deposit_note && (
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-amber-500/20 text-amber-200 space-y-1">
                  <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                    Deposit &amp; Clearance Notice:
                  </span>
                  <p className="text-amber-300/80">{resource.deposit_note}</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Upcoming Bookings Strip & Weekly Schedule (Anonymised: Times only, no names, for privacy) */}
        <section className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>Weekly Schedule &amp; Reserved Intervals (Anonymized)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Privacy-protected campus occupancy. Confirmed slots and operating availability across this week.
              </p>
            </div>
          </div>

          {/* 7-Day Calendar Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {weekDays.map((day, idx) => {
              const dayBookings = (upcomingBookings || []).filter((b: any) =>
                isSameDay(new Date(b.start_at), day)
              );
              const today = isToday(day);

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    today
                      ? "bg-indigo-950/40 border-indigo-500/50 shadow-xs"
                      : "bg-slate-950/60 border-slate-800/80"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5 mb-1.5">
                    <span className={`text-[11px] font-semibold uppercase ${today ? "text-indigo-300" : "text-slate-400"}`}>
                      {format(day, "EEE")}
                    </span>
                    <span className={`text-xs font-bold font-mono ${today ? "text-white" : "text-slate-300"}`}>
                      {format(day, "d")}
                    </span>
                    {today && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    )}
                  </div>

                  {dayBookings.length === 0 ? (
                    <span className="text-[10px] text-slate-500 block py-1">Available</span>
                  ) : (
                    <div className="space-y-1">
                      {dayBookings.map((b: any) => (
                        <div
                          key={b.id}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 text-rose-300 border border-rose-500/20 truncate"
                        >
                          {format(new Date(b.start_at), "HH:mm")}-{format(new Date(b.end_at), "HH:mm")}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Confirmed Slot Cards */}
          <div className="pt-2 border-t border-slate-800/80">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Confirmed Reservation Slots
            </h3>
            {!upcomingBookings || upcomingBookings.length === 0 ? (
              <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-center text-xs text-slate-500">
                No confirmed reservations scheduled for this resource. Free slots can be booked during operating windows.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {upcomingBookings.map((b: any) => {
                  const start = new Date(b.start_at);
                  const end = new Date(b.end_at);
                  return (
                    <div
                      key={b.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono"
                    >
                      <div className="space-y-0.5">
                        <span className="text-indigo-400 font-bold block">{format(start, "EEE, MMM d")}</span>
                        <span className="text-slate-300 text-[11px]">
                          {format(start, "h:mm a")} - {format(end, "h:mm a")}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                        Booked
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </AuthenticatedLayout>
  );
}
