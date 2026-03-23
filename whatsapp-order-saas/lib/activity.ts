/**
 * logActivity — write an immutable audit entry to activity_logs.
 * Fire-and-forget safe: never throws, errors are logged to console only.
 * Always uses the service-role client so activity logs survive even when
 * the calling user's RLS would otherwise block the insert.
 */

import { createAdminClient } from "@/lib/supabaseAdmin";

export interface ActivityPayload {
  workspaceId: string;
  actorId: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  meta?: Record<string, unknown>;
}

export async function logActivity(payload: ActivityPayload): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("activity_logs").insert({
      workspace_id: payload.workspaceId,
      actor_id:    payload.actorId,
      entity_type: payload.entityType,
      entity_id:   payload.entityId ?? null,
      action:      payload.action,
      meta:        payload.meta ?? {},
    });
    if (error) {
      console.error("[logActivity]", error.message);
    }
  } catch (err) {
    console.error("[logActivity] unexpected:", err);
  }
}
