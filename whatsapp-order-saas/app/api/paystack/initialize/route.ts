import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import {
  initializeTransaction,
  generateReference,
  toKobo,
} from "@/lib/paystack";

/**
 * POST /api/paystack/initialize
 *
 * Body:
 *   order_id     string  – UUID of the order to pay for
 *   email        string  – Customer email (required by Paystack)
 *   amount       number  – Amount in NGN (overrides order total_amount if provided)
 *   callback_url string  – Where Paystack should redirect after payment
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { order_id, email, callback_url } = body as {
      order_id?: string;
      email?: string;
      amount?: number;
      callback_url?: string;
    };

    if (!order_id || !email || !callback_url) {
      return NextResponse.json(
        { error: "order_id, email, and callback_url are required." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // ── Fetch the order ──────────────────────────────────────────────────────
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, vendor_id, total_amount, payment_status")
      .eq("id", order_id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.payment_status === "paid") {
      return NextResponse.json(
        { error: "This order has already been paid." },
        { status: 409 }
      );
    }

    // Caller may override the amount (e.g. vendor confirmed a different price)
    const amountNGN: number = body.amount > 0 ? body.amount : Number(order.total_amount);

    if (amountNGN <= 0) {
      return NextResponse.json(
        {
          error:
            "Order amount is 0. The vendor must confirm the price before payment.",
        },
        { status: 422 }
      );
    }

    const reference = generateReference(order_id);

    // ── Call Paystack ────────────────────────────────────────────────────────
    const paystackResponse = await initializeTransaction({
      email,
      amount: toKobo(amountNGN),
      reference,
      callback_url,
      metadata: {
        order_id,
        vendor_id: order.vendor_id,
        source: "whatsorder-storefront",
      },
    });

    if (!paystackResponse.status) {
      return NextResponse.json(
        { error: paystackResponse.message ?? "Paystack initialization failed." },
        { status: 502 }
      );
    }

    // ── Persist payment attempt in DB ────────────────────────────────────────
    const { error: paymentErr } = await supabase.from("payments").insert({
      order_id,
      provider: "paystack",
      paystack_reference: reference,
      amount: amountNGN,
      currency: "NGN",
      status: "pending",
    });

    if (paymentErr) {
      // Non-fatal: the checkout URL is still valid. Log and continue.
      console.error("[paystack/initialize] Failed to create payment row:", paymentErr.message);
    }

    return NextResponse.json({
      authorization_url: paystackResponse.data.authorization_url,
      reference: paystackResponse.data.reference,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error.";
    console.error("[paystack/initialize]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
