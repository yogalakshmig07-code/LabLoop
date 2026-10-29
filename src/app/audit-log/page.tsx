import { requireRole } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function AuditLogRedirectPage() {
  const session = await requireRole(["admin", "owner", "manager"]);
  if (session.role === "admin") {
    redirect("/admin/audit");
  } else {
    redirect("/audit");
  }
}
