import { NextResponse } from "next/server";
import { claimNextJob, completeJob, failJob } from "@/lib/jobs";
import { processInboundMessage } from "@/lib/actions/inbound";
import { runAutomationForEvent } from "@/lib/automation";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { sendTextMessage } from "@/lib/whatsapp";
import { NotificationJobPayload } from "@/lib/notificationQueue";

export const dynamic = "force-dynamic";

const DEFAULT_QUEUES = ["process_inbound_message", "notify_staff_draft", "automation_event", "log_activity"];

export async function GET(request: Request) {
  return handleWorkerRequest(request);
}

/**
 * POST /api/jobs/worker
 *
 * Triggered by cron or a protected internal call.
 * Headers:
 *   x-worker-secret: must match WORKER_SECRET env var
 * Query params:
 *   maxJobs (default 20)
 *   queue (optional) e.g. queue=automation_event
 */
export async function POST(request: Request) {
  return handleWorkerRequest(request);
}

async function handleWorkerRequest(request: Request) {
  const authResult = authorizeWorkerRequest(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { searchParams } = new URL(request.url);
  const maxJobs = Math.max(1, Math.min(100, Number(searchParams.get("maxJobs") ?? 20)));
  const queueParam = searchParams.get("queue");
  const queues = queueParam ? [queueParam] : DEFAULT_QUEUES;

  const summary = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    byQueue: {} as Record<string, number>,
  };

  for (let i = 0; i < maxJobs; i++) {
    let worked = false;

    for (const queue of queues) {
      const job = await claimNextJob(queue);
      if (!job) continue;

      worked = true;
      summary.processed += 1;
      summary.byQueue[queue] = (summary.byQueue[queue] ?? 0) + 1;

      try {
        await executeJob(queue, job.payload as Record<string, unknown>);
        await completeJob(job.id);
        summary.succeeded += 1;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        await failJob(job, message);
        summary.failed += 1;
      }
    }

    if (!worked) {
      summary.skipped += 1;
      break;
    }
  }

  return NextResponse.json({ ok: true, source: authResult.source, summary });
}

function authorizeWorkerRequest(request: Request): {
  ok: boolean;
  status: number;
  error?: string;
  source?: "worker_secret_header" | "worker_secret_query" | "cron_bearer";
} {
  const workerSecret = process.env.WORKER_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  const headerSecret = request.headers.get("x-worker-secret") ?? "";
  if (workerSecret && headerSecret === workerSecret) {
    return { ok: true, status: 200, source: "worker_secret_header" };
  }

  const { searchParams } = new URL(request.url);
  const querySecret = searchParams.get("secret") ?? "";
  if (workerSecret && querySecret === workerSecret) {
    return { ok: true, status: 200, source: "worker_secret_query" };
  }

  const authz = request.headers.get("authorization") ?? "";
  if (cronSecret && authz === `Bearer ${cronSecret}`) {
    return { ok: true, status: 200, source: "cron_bearer" };
  }

  if (!workerSecret && !cronSecret) {
    console.error("[worker] Neither WORKER_SECRET nor CRON_SECRET is configured.");
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: false, status: 401, error: "Unauthorized" };
}

async function executeJob(queue: string, payload: Record<string, unknown>): Promise<void> {
  if (queue === "process_inbound_message") {
    await processInboundMessage(
      String(payload.eventId ?? ""),
      String(payload.workspaceId ?? ""),
      String(payload.fromPhone ?? ""),
      String(payload.messageText ?? "")
    );
    return;
  }

  if (queue === "notify_staff_draft") {
    await notifyStaffDraft(payload);
    return;
  }

  if (queue === "automation_event") {
    await runAutomationForEvent({
      workspaceId: String(payload.workspaceId ?? ""),
      trigger: payload.trigger as Parameters<typeof runAutomationForEvent>[0]["trigger"],
      entityType: payload.entityType as Parameters<typeof runAutomationForEvent>[0]["entityType"],
      entityId: payload.entityId ? String(payload.entityId) : undefined,
      meta: (payload.meta ?? {}) as Record<string, unknown>,
    });
    return;
  }

  if (queue === "log_activity") {
    const { logActivity } = await import("@/lib/activity");
    await logActivity({
      workspaceId: String(payload.workspaceId ?? ""),
      actorId: payload.actorId ? String(payload.actorId) : null,
      entityType: String(payload.entityType ?? ""),
      entityId: payload.entityId ? String(payload.entityId) : undefined,
      action: String(payload.action ?? ""),
      meta: (payload.meta ?? {}) as Record<string, unknown>,
    });
    return;
  }

  if (queue === "notification_outbound") {
    await handleNotificationOutbound(payload);
    return;
  }

  throw new Error(`Unsupported queue: ${queue}`);


async function handleNotificationOutbound(payload: Record<string, unknown>): Promise<void> {
  // Type guard for NotificationJobPayload
  function isNotificationJobPayload(obj: any): obj is NotificationJobPayload {
    return (
      typeof obj === "object" &&
      obj !== null &&
      typeof obj.type === "string" &&
      typeof obj.recipient === "string" &&
      typeof obj.channel === "string" &&
      (obj.channel === "whatsapp" || obj.channel === "sms" || obj.channel === "email" || obj.channel === "inapp") &&
      typeof obj.template === "string" &&
      typeof obj.data === "object"
    );
  }

  if (!isNotificationJobPayload(payload)) {
    throw new Error("Invalid notification job payload");
  }
  const job = payload;
  // WhatsApp only for now; extend for SMS/email/inapp
  if (job.channel === "whatsapp") {
    const to = job.recipient;
    const message = typeof job.template === "string"
      ? job.template
      : JSON.stringify(job.template);
    await sendTextMessage(to, message);
    return;
  }
  // TODO: Add SMS, email, in-app notification support
  throw new Error(`Unsupported notification channel: ${job.channel}`);
}
}

async function notifyStaffDraft(payload: Record<string, unknown>): Promise<void> {
  const workspaceId = String(payload.workspaceId ?? "");
  const draftId = String(payload.draftId ?? "");
  const customerPhone = String(payload.customerPhone ?? "");
  const confidence = Number(payload.confidence ?? 0);

  if (!workspaceId || !draftId) return;

  const admin = createAdminClient();

  // Persist in-product notification trail
  await admin.from("activity_logs").insert({
    workspace_id: workspaceId,
    actor_id: null,
    entity_type: "order_draft",
    entity_id: draftId,
    action: "draft_pending_review",
    meta: {
      customer_phone: customerPhone,
      confidence,
    },
  });

  // WhatsApp ping to owner phone (if configured)
  const { data: owner } = await admin
    .from("users")
    .select("phone, business_name")
    .eq("id", workspaceId)
    .maybeSingle();

  const phone = (owner?.phone as string | null) ?? null;
  if (!phone) return;

  const confidencePct = Math.round(confidence * 100);
  const msg =
    `New AI order draft needs review for ${owner?.business_name ?? "your workspace"}.\n` +
    `Draft ID: ${draftId.slice(0, 8).toUpperCase()}\n` +
    `Customer: ${customerPhone || "Unknown"}\n` +
    `Confidence: ${confidencePct}%\n\n` +
    `Open dashboard: /dashboard/drafts`;

  await sendTextMessage(phone, msg);
}
