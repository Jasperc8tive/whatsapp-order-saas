import { createAdminClient } from "@/lib/supabaseAdmin";

export type NotificationJobType = "manager_assignment" | "customer_status";

export interface NotificationJobPayload {
  type: NotificationJobType;
  recipient: string; // phone/email/userId
  channel: "whatsapp" | "sms" | "email" | "inapp";
  template: string; // template name or message
  data: Record<string, any>;
}

/**
 * Enqueue a notification job for outbound delivery (manager/customer).
 */
export async function enqueueNotificationJob(payload: NotificationJobPayload) {
  const admin = createAdminClient();
  await admin.rpc("enqueue_job", {
    p_queue_name: "notification_outbound",
    p_payload: payload,
  });
}
