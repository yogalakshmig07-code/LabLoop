import { AuthenticatedLayout } from "@/components/shell/authenticated-layout";
import { getUserNotifications } from "@/actions/notifications";
import { Bell, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export default async function NotificationsPage() {
  const { notifications, unreadCount } = await getUserNotifications(50);

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <Bell className="w-6 h-6 text-indigo-400" />
              <span>Notifications</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              System updates, reservation status changes, and equipment return reminders.
            </p>
          </div>
          {unreadCount > 0 && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {unreadCount} unread
            </span>
          )}
        </div>

        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 text-sm">
              You have no notifications yet.
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  notif.is_read
                    ? "bg-slate-900/60 border-slate-800/80"
                    : "bg-slate-900 border-indigo-500/30 shadow-lg shadow-indigo-950/20"
                }`}
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                    )}
                    <h3 className="font-semibold text-sm text-white">{notif.title}</h3>
                    <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed pl-4">{notif.body}</p>
                </div>

                {notif.link && (
                  <Link
                    href={notif.link}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors shrink-0 self-start sm:self-center"
                  >
                    <span>Open</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
