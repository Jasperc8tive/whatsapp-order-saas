/**
 * sendWhatsAppNotification
 *
 * Sends a WhatsApp message to the VENDOR when a new order arrives.
 * This is separate from lib/whatsapp.ts which handles customer-facing messages.
 *
 * Flow:
 *   NewOrderModal (client) → POST /api/notify/new-order (server)
 *     → sendVendorNewOrderNotification() (this file)
 *       → sendTextMessage() from lib/whatsapp.ts
 *         → Meta WhatsApp Cloud API
 *
 * Required env vars (server-only, no NEXT_PUBLIC_ prefix):
 *   WHATSAPP_ACCESS_TOKEN      – Meta system user token
 *   WHATSAPP_PHONE_NUMBER_ID   – Your sender phone number ID
 *   WHATSAPP_API_VERSION       – Optional, defaults to "v19.0"
 *
 * To connect a real WhatsApp API later, see the bottom of this file.
 */

import { sendTextMessage, type WhatsAppSendResult } from "@/lib/whatsapp";

// ── Payload ───────────────────────────────────────────────────────────────────

export interface NewOrderNotificationPayload {
  vendorWhatsappNumber: string; // vendor's registered WhatsApp number
  customerName: string;
  customerPhone: string;
  product: string;
  quantity: number;
  orderId: string;
}

// ── Message builder ───────────────────────────────────────────────────────────

function buildVendorMessage(p: NewOrderNotificationPayload): string {
  const lines = [
    `🛍️ *New Order Received!*`,
    ``,
    `👤 *Customer:* ${p.customerName}`,
    `📱 *Phone:* ${p.customerPhone}`,
    `📦 *Product:* ${p.product}`,
    `🔢 *Quantity:* ${p.quantity}`,
    `🆔 *Order ID:* ${p.orderId.slice(0, 8).toUpperCase()}`,
    ``,
    `Open your dashboard to update the order status.`,
  ];

  return lines.join("\n");
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Notify a vendor on WhatsApp that a new order has been placed.
 * Fire-and-forget safe: never throws — errors are logged and returned.
 */
export async function sendVendorNewOrderNotification(
  payload: NewOrderNotificationPayload
): Promise<WhatsAppSendResult> {
  if (!payload.vendorWhatsappNumber) {
    console.warn(
      "[sendWhatsAppNotification] Vendor has no whatsapp_number set — skipping notification."
    );
    return { ok: false, error: "Vendor WhatsApp number not configured." };
  }

  const message = buildVendorMessage(payload);

  console.log(
    `[sendWhatsAppNotification] Notifying vendor at ${payload.vendorWhatsappNumber} for order ${payload.orderId}`
  );

  return sendTextMessage(payload.vendorWhatsappNumber, message);
}

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  HOW TO CONNECT A REAL WHATSAPP API
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  OPTION A — Meta WhatsApp Cloud API (recommended, already wired)
 *  ──────────────────────────────────────────────────────────────
 *  1. Go to https://developers.facebook.com/apps/ → Create App → Business
 *  2. Add the "WhatsApp" product to your app
 *  3. In WhatsApp > Getting Started:
 *     - Copy the "Phone number ID"  → WHATSAPP_PHONE_NUMBER_ID
 *     - Generate a permanent System User token → WHATSAPP_ACCESS_TOKEN
 *  4. Add a real recipient number in "Test phone numbers" for sandbox testing
 *  5. Paste both values into .env.local (see .env.local.example)
 *  6. Deploy and test with a real phone number
 *
 *  The `sendTextMessage()` function in lib/whatsapp.ts already implements
 *  the full Cloud API call — no code changes needed once env vars are set.
 *
 *  OPTION B — Twilio for WhatsApp
 *  ───────────────────────────────
 *  Replace the `sendTextMessage` call above with:
 *
 *    import twilio from "twilio";
 *    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
 *    await client.messages.create({
 *      from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
 *      to:   `whatsapp:${payload.vendorWhatsappNumber}`,
 *      body: message,
 *    });
 *
 *  OPTION C — 3rd-party providers (Zoko, WatiApp, Interakt)
 *  ──────────────────────────────────────────────────────────
 *  These wrap the Cloud API with a simpler REST interface.
 *  Replace the `sendTextMessage` call with their SDK/fetch call.
 *  The message string built here works for any provider.
 *
 * ════════════════════════════════════════════════════════════════════════════
 */
