import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { enqueueJob } from "@/lib/jobs";

/**
 * GET /api/whatsapp/webhook
 *
 * Meta webhook verification challenge.
 * Set your webhook URL in Meta for Developers → App → WhatsApp → Configuration.
 *
 * Required env:
 *   WHATSAPP_WEBHOOK_VERIFY_TOKEN  — any secret string you choose, match it in Meta dashboard
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!verifyToken) {
    console.error("[whatsapp/webhook] WHATSAPP_WEBHOOK_VERIFY_TOKEN not set.");
    return new Response("Server misconfiguration.", { status: 500 });
  }

  if (mode === "subscribe" && token === verifyToken) {
    console.info("[whatsapp/webhook] Verification successful.");
    return new Response(challenge ?? "", { status: 200 });
  }

  console.warn("[whatsapp/webhook] Verification failed — token mismatch.");
  return new Response("Forbidden.", { status: 403 });
}

/**
 * POST /api/whatsapp/webhook
 *
 * Receives inbound WhatsApp messages from Meta Cloud API.
 * Returns 200 immediately; processing is kicked off inline.
 *
 * Security: HMAC-SHA256 signature verified against X-Hub-Signature-256 header.
 *
 * Required env:
 *   WHATSAPP_APP_SECRET  — Meta App Secret (Meta Developer Portal → App → Settings → Basic)
 */
export async function POST(request: Request) {
  // 1. Read raw body — must be raw bytes for HMAC verification
  const rawBody = await request.text();

  // 2. Verify HMAC-SHA256 signature
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    console.error("[whatsapp/webhook] WHATSAPP_APP_SECRET not set.");
    return NextResponse.json({ error: "Server misconfiguration." }, { status: 500 });
  }

  const signature = request.headers.get("x-hub-signature-256") ?? "";
  if (!signature) {
    console.warn("[whatsapp/webhook] Missing X-Hub-Signature-256 header.");
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const expectedSig = "sha256=" + crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSig);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    console.warn("[whatsapp/webhook] Signature mismatch — possible forgery.");
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  // 3. Parse payload
  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Malformed JSON." }, { status: 400 });
  }

  // 4. Return 200 immediately — then process (fire-and-forget)
  //    If we have Next.js waitUntil support, great; otherwise inline with catch.
  handleWebhookPayload(payload).catch((err: unknown) => {
    console.error("[whatsapp/webhook] Processing error:", err);
  });

  return NextResponse.json({ received: true });
}

// ─── Process webhook payload ──────────────────────────────────────────────────

async function handleWebhookPayload(payload: MetaWebhookPayload) {
  const admin = createAdminClient();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const toPhone = value?.metadata?.display_phone_number ?? "";

      // Find workspace by their registered WhatsApp number
      const { data: vendor } = await admin
        .from("users")
        .select("id")
        .eq("whatsapp_number", toPhone)
        .maybeSingle();

      if (!vendor) {
        console.warn("[whatsapp/webhook] No workspace found for phone:", toPhone);
        continue;
      }

      for (const message of value?.messages ?? []) {
        if (message.type !== "text") continue;
        const messageText = message.text?.body ?? "";
        if (!messageText.trim()) continue;

        // Idempotency: skip if already processed
        const { data: existing } = await admin
          .from("inbound_message_events")
          .select("id")
          .eq("provider", "meta_whatsapp")
          .eq("provider_message_id", message.id)
          .maybeSingle();

        if (existing) {
          console.info("[whatsapp/webhook] Duplicate message, skipping:", message.id);
          continue;
        }

        // Persist the event
        const { data: event, error: insertErr } = await admin
          .from("inbound_message_events")
          .insert({
            workspace_id:        vendor.id,
            provider:            "meta_whatsapp",
            provider_message_id: message.id,
            from_phone:          message.from,
            to_phone:            toPhone,
            message_type:        message.type,
            message_text:        messageText,
            payload:             message,
          })
          .select("id")
          .single();

        if (insertErr || !event) {
          console.error("[whatsapp/webhook] Failed to save event:", insertErr?.message);
          continue;
        }

        // Queue async processing; worker route will parse and route draft/auto-order logic.
        await enqueueJob("process_inbound_message", {
          eventId: event.id,
          workspaceId: vendor.id,
          fromPhone: message.from,
          messageText,
        });
      }
    }
  }
}

// ─── Meta payload types ───────────────────────────────────────────────────────

interface MetaWebhookPayload {
  object: string;
  entry?: Array<{
    id: string;
    changes?: Array<{
      value?: {
        metadata?: { display_phone_number: string; phone_number_id: string };
        messages?: Array<MetaMessage>;
      };
      field: string;
    }>;
  }>;
}

interface MetaMessage {
  id: string;
  from: string;
  timestamp: string;
  type: "text" | "image" | "audio" | "video" | "document" | "button" | "interactive";
  text?: { body: string };
}
