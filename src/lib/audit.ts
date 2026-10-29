import "server-only";
import { createAdminClient } from "./supabase/admin";
import { Json } from "@/types/db";

export interface LogAuditParams {
  actor?: {
    id?: string | null;
    name?: string | null;
  } | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  bookingId?: string | null;
  resourceId?: string | null;
  reason?: string | null;
  details?: Record<string, unknown> | Json;
}

/**
 * Inserts an immutable event record into the append-only audit_log table.
 * Uses the service-role admin client to bypass user RLS restrictions.
 */
export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    const admin = createAdminClient();

    const { error } = await admin.from("audit_log").insert({
      actor_id: params.actor?.id || null,
      actor_name: params.actor?.name || null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      booking_id: params.bookingId || null,
      resource_id: params.resourceId || null,
      reason: params.reason || null,
      details: (params.details as Json) || {},
    });

    if (error) {
      console.error("Failed to write audit_log record:", error.message, params);
    }
  } catch (err) {
    console.error("Exception during logAudit:", err);
  }
}

