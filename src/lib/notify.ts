import "server-only";
import { createAdminClient } from "./supabase/admin";

/**
 * Creates an in-app notification for a single recipient.
 */
export async function notify(
  userId: string,
  title: string,
  body: string,
  link?: string | null
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("notifications").insert({
      user_id: userId,
      title,
      body,
      link: link || null,
      is_read: false,
    });

    if (error) {
      console.error(`Failed to send notification to ${userId}:`, error.message);
    }
  } catch (err) {
    console.error("Exception in notify:", err);
  }
}

/**
 * Creates in-app notifications for multiple recipients in batch.
 */
export async function notifyMany(
  userIds: string[],
  title: string,
  body: string,
  link?: string | null
): Promise<void> {
  if (!userIds || userIds.length === 0) return;

  try {
    const admin = createAdminClient();
    const records = userIds.map((userId) => ({
      user_id: userId,
      title,
      body,
      link: link || null,
      is_read: false,
    }));

    const { error } = await admin.from("notifications").insert(records);
    if (error) {
      console.error("Failed to send bulk notifications:", error.message);
    }
  } catch (err) {
    console.error("Exception in notifyMany:", err);
  }
}

