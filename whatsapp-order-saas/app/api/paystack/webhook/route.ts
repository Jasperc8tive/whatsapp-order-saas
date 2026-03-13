import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import {
  verifyWebhookSignature,
  verifyTransaction,
  fromKobo,
  type PaystackWebhookEvent,
} from "@/lib/paystack";
import { notifyPaymentConfirmed } from "@/lib/whatsapp";

/**
 * POST /api/paystack/webhook
 *
 * Receives Paystack webhook events.
 * Configure this URL in your Paystack dashboard → Settings → API Keys & Webhooks.
 *
 * Security: Paystack signs every request with HMAC-SHA512 using your secret key.
 * We MUST validate the signature before trusting the payload.
 */
export async function POST(request: Request) {
  // ── 1. Read raw body (must be raw string for HMAC verification) ─────────
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature") ?? "";

  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  // ── 2. Verify signature ──────────────────────────────────────────────────
  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn("[paystack/webhook] Invalid signature — possible forgery attempt.");
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  // ── 3. Parse event ───────────────────────────────────────────────────────
  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaystackWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Malformed JSON." }, { status: 400 });
  }

  // Acknowledge receipt immediately so Paystack doesn't retry unnecessarily
  // (we handle the event below)

  // ── 4. Handle charge.success ─────────────────────────────────────────────
  if (event.event === "charge.success") {
    const txData = event.data;
    const reference = txData.reference;

    // Double-verify with Paystack API (defence-in-depth: don't trust the webhook alone)
    let verified;
    try {
      verified = await verifyTransaction(reference);
    } catch (err) {
      console.error("[paystack/webhook] Verification call failed:", err);
      // Return 200 so Paystack doesn't retry; we'll handle it via /api/verify-payment
      return NextResponse.json({ received: true });
    }

    if (!verified.status || verified.data.status !== "success") {
      console.warn("[paystack/webhook] Verification returned non-success for ref:", reference);
      return NextResponse.json({ received: true });
    }

    const supabase = createAdminClient();

    // ── Upsert payment record ─────────────────────────────────────────────
    // Use upsert on paystack_reference — idempotent if webhook fires twice
    const { error: upsertErr } = await supabase
      .from("payments")
      .upsert(
        {
          order_id: verified.data.metadata?.order_id as string,
          provider: "paystack",
          paystack_reference: reference,
          amount: fromKobo(verified.data.amount),
          currency: verified.data.currency,
          status: "paid",
          paid_at: verified.data.paid_at ?? new Date().toISOString(),
          meta: verified.data as unknown as Record<string, unknown>,
        },
        { onConflict: "paystack_reference" }
      );

    if (upsertErr) {
      console.error("[paystack/webhook] Failed to upsert payment:", upsertErr.message);
      // Return 500 so Paystack retries
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    // The DB trigger `trg_sync_payment_status` automatically flips
    // orders.payment_status → 'paid' when the payment row reaches status='paid'.
    // No manual order update needed here.

    const orderId = verified.data.metadata?.order_id as string | undefined;
    console.log(`[paystack/webhook] Payment confirmed for order ${orderId} ref ${reference}`);

    // ── Fetch customer details and send WhatsApp notification ──────────────
    if (orderId) {
      const { data: orderRow } = await supabase
        .from("orders")
        .select("id, customers ( name, phone )")
        .eq("id", orderId)
        .single();

      const customer = (orderRow?.customers as unknown) as { name: string; phone: string } | null;

      if (customer?.phone) {
        notifyPaymentConfirmed({
          customerName: customer.name,
          customerPhone: customer.phone,
          orderId,
          orderRef: orderId.slice(0, 8).toUpperCase(),
          amountNgn: fromKobo(verified.data.amount),
          paystackReference: reference,
        });
      }
    }
  }

  // Return 200 for all other event types (Paystack expects 200 or will retry)
  return NextResponse.json({ received: true });
}
