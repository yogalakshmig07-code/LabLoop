import { requireRole } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import { getFairnessSettings } from "@/lib/bookings";
import { FairnessSettingsForm } from "@/components/settings/fairness-settings-form";
import { Scale } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireRole(["admin"]);
  const settings = await getFairnessSettings();

  return (
    <AuthenticatedLayout allowedRoles={["admin"]}>
      <div className="space-y-6 max-w-5xl">
        <div className="border-b border-slate-800 pb-5">
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Scale className="w-6 h-6 text-indigo-400" />
            <span>Fairness Policy &amp; System Allocation Settings</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure campus-wide booking limits, weekly category hour quotas, strike thresholds, and examine the waitlist ranking formula.
          </p>
        </div>

        <FairnessSettingsForm
          initialSettings={{
            max_active_bookings: settings.max_active_bookings,
            max_hours_per_week_per_category: settings.max_hours_per_week_per_category,
            strike_threshold: settings.strike_threshold,
            reminder_minutes_before: settings.reminder_minutes_before,
          }}
        />
      </div>
    </AuthenticatedLayout>
  );
}

