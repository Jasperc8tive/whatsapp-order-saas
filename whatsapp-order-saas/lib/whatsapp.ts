/**
 * WhatsApp Cloud API notification service.
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages
 *
 * Required env vars:
 *   WHATSAPP_ACCESS_TOKEN      – Meta system user access token (permanent token recommended)
 *   WHATSAPP_PHONE_NUMBER_ID   – The sender phone number ID from Meta Business Manager
 *   WHATSAPP_API_VERSION       – Optional; defaults to "v19.0"
 *
 * All notification functions are fire-and-forget safe: they catch and log
 * errors without propagating them, so a failed WhatsApp send never breaks
 * the caller's main flow.
 */

import { optionalEnvValue, requireEnvValue } from "@/lib/env";

// ── Config ────────────────────────────────────────────────────────────────────

const API_VERSION = optionalEnvValue(process.env.WHATSAPP_API_VERSION, "v19.0");

function getConfig(): { accessToken: string; phoneNumberId: string } {
  const accessToken = requireEnvValue(
    process.env.WHATSAPP_ACCESS_TOKEN,
    "WHATSAPP_ACCESS_TOKEN"
  );
  const phoneNumberId = requireEnvValue(
    process.env.WHATSAPP_PHONE_NUMBER_ID,
    "WHATSAPP_PHONE_NUMBER_ID"
  );

  return { accessToken, phoneNumberId };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WhatsAppTextPayload {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "text";
  text: { body: string; preview_url?: boolean };
}

export interface WhatsAppSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export interface OrderCreatedPayload {
  customerName: string;
  customerPhone: string;
  orderId: string;
  orderRef: string;      // short 8-char ref e.g. "A1B2C3D4"
  vendorName: string;
  items: Array<{ product_name: string; quantity: number }>;
  address: string;
  notes?: string | null;
}

export interface PaymentConfirmedPayload {
  customerName: string;
  customerPhone: string;
  orderId: string;
  orderRef: string;
  amountNgn: number;
  paystackReference: string;
}

export interface OrderShippedPayload {
  customerName: string;
  customerPhone: string;
  orderId: string;
  orderRef: string;
  vendorName: string;
  courier?: string | null;
  trackingId?: string | null;
}

export interface DraftRejectedPayload {
  customerName: string;
  customerPhone: string;
  vendorName: string;
  reason?: string | null;
}

// ── Phone normalisation ───────────────────────────────────────────────────────

/**
 * Strip everything except digits, then ensure the number starts with a
 * country code (no leading +). E.g.:
 *   "+234 801 234 5678" → "2348012345678"
 *   "08012345678"       → "2348012345678"  (assumes NG +234 if 11-digit local)
 */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");

  // Nigerian local format: starts with 0, 11 digits → prepend 234
  if (digits.startsWith("0") && digits.length === 11) {
    return `234${digits.slice(1)}`;
  }

  // Already has country code (no leading zero, ≥12 digits)
  if (digits.length >= 12) {
    return digits;
  }

  // Unrecognised format — log a warning so it is visible in monitoring.
  console.warn(
    `[whatsapp] normalisePhone: unrecognised format for "${raw}" (${digits.length} digits). ` +
    `Expected either an 11-digit Nigerian local number (0XXXXXXXXXX) or an international ` +
    `number with country code (≥12 digits). Passing digits through as-is.`
  );
  return digits;
}

// ── Core send function ────────────────────────────────────────────────────────

/**
 * Send a free-form text message to a single recipient.
 * Returns a result object — never throws.
 */
export async function sendTextMessage(
  to: string,
  body: string
): Promise<WhatsAppSendResult> {
  try {
    const { accessToken, phoneNumberId } = getConfig();
    const toNormalised = normalisePhone(to);

    const payload: WhatsAppTextPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toNormalised,
      type: "text",
      text: { body },
    };

    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const json = await res.json() as {
      messages?: Array<{ id: string }>;
      error?: { message: string; code: number };
    };

    if (!res.ok || json.error) {
      const msg = json.error?.message ?? `HTTP ${res.status}`;
      console.error(`[whatsapp] Send failed to ${toNormalised}: ${msg}`);
      return { ok: false, error: msg };
    }

    const messageId = json.messages?.[0]?.id;
    console.log(`[whatsapp] Message sent to ${toNormalised} → ${messageId}`);
    return { ok: true, messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[whatsapp] Unexpected error: ${message}`);
    return { ok: false, error: message };
  }
}

// ── Message templates ─────────────────────────────────────────────────────────

function buildOrderCreatedMessage(p: OrderCreatedPayload): string {
  const itemLines = p.items
    .map((i) => `  • ${i.quantity}× ${i.product_name}`)
    .join("\n");

  const notesPart = p.notes ? `\n📝 Note: ${p.notes}` : "";

  return [
    `Hello ${p.customerName}! 👋`,
    ``,
    `Your order *#${p.orderRef}* has been received by *${p.vendorName}*.`,
    ``,
    `📦 *Order summary:*`,
    itemLines,
    ``,
    `📍 *Delivery to:* ${p.address}`,
    notesPart,
    ``,
    `The vendor will confirm your order and pricing shortly.`,
    `Reply to this message if you have any questions.`,
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}

function buildPaymentConfirmedMessage(p: PaymentConfirmedPayload): string {
  const amount = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(p.amountNgn);

  return [
    `Hello ${p.customerName}! ✅`,
    ``,
    `Payment confirmed for order *#${p.orderRef}*.`,
    ``,
    `💰 *Amount paid:* ${amount}`,
    `🔖 *Paystack ref:* ${p.paystackReference}`,
    ``,
    `Your order is now being prepared. We'll notify you when it ships! 🚀`,
  ].join("\n");
}

function buildOrderShippedMessage(p: OrderShippedPayload): string {
  const trackingPart =
    p.courier || p.trackingId
      ? [
          ``,
          `🚚 *Courier:* ${p.courier ?? "N/A"}`,
          p.trackingId ? `📬 *Tracking ID:* ${p.trackingId}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      : "";

  return [
    `Hello ${p.customerName}! 📦`,
    ``,
    `Great news! Your order *#${p.orderRef}* is on its way.`,
    trackingPart,
    ``,
    `Thank you for ordering from *${p.vendorName}*! We hope to see you again soon. 🙏`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function buildDraftRejectedMessage(p: DraftRejectedPayload): string {
  const resolvedName = p.customerName?.trim() || "there";
  const reasonLine = p.reason?.trim()
    ? `Reason: ${p.reason.trim()}`
    : "Reason: We need a bit more detail before we can confirm the order.";

  return [
    `Hello ${resolvedName},`,
    "",
    `We could not confirm your order request with *${p.vendorName}* just yet.`,
    reasonLine,
    "",
    "Please reply with the correct details or send a fresh order message and we'll help you right away.",
  ].join("\n");
}

// ── Public notification functions ─────────────────────────────────────────────

/**
 * Notify the customer that their order has been received.
 * Called immediately after order creation in the storefront action.
 */
export async function notifyOrderCreated(
  payload: OrderCreatedPayload
): Promise<WhatsAppSendResult> {
  return sendTextMessage(
    payload.customerPhone,
    buildOrderCreatedMessage(payload)
  );
}

/**
 * Notify the customer that their payment was successful.
 * Called from the Paystack webhook handler after DB sync.
 */
export async function notifyPaymentConfirmed(
  payload: PaymentConfirmedPayload
): Promise<WhatsAppSendResult> {
  return sendTextMessage(
    payload.customerPhone,
    buildPaymentConfirmedMessage(payload)
  );
}

/**
 * Notify the customer that their order has shipped.
 * Called when order_status is updated to "shipped".
 */
export async function notifyOrderShipped(
  payload: OrderShippedPayload
): Promise<WhatsAppSendResult> {
  return sendTextMessage(
    payload.customerPhone,
    buildOrderShippedMessage(payload)
  );
}

export async function notifyDraftRejected(
  payload: DraftRejectedPayload
): Promise<WhatsAppSendResult> {
  return sendTextMessage(
    payload.customerPhone,
    buildDraftRejectedMessage(payload)
  );
}
