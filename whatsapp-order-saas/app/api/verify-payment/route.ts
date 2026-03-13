import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { verifyTransaction, fromKobo } from "@/lib/paystack";

/**
 * GET /api/verify-payment?reference=OF-XXXXXXXX-XXXXXX
 *
 * Used by the payment callback page (and optionally the storefront) to:
 *  1. Fetch the live status from Paystack
 *  2. Sync the result into our DB (idempotent)
 *  3. Return structured data to the caller
 *
 * This endpoint is intentionally public so the customer's browser can
 * poll it after the Paystack redirect without needing to be logged in.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get("reference");

    if (!reference) {
      return NextResponse.json(
        { error: "reference query parameter is required." },
        { status: 400 }
      );
    }

    // ── 1. Verify with Paystack ──────────────────────────────────────────
    const result = await verifyTransaction(reference);

    if (!result.status) {
      return NextResponse.json(
        { error: result.message ?? "Paystack verification failed." },
        { status: 502 }
      );
    }

    const tx = result.data;
    const isPaid = tx.status === "success";

    const supabase = createAdminClient();

    // ── 2. Look up the payment row to get the order_id ───────────────────
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id, order_id, status")
      .eq("paystack_reference", reference)
      .single();

    const orderId =
      existingPayment?.order_id ??
      (tx.metadata?.order_id as string | undefined);

    // ── 3. Sync the payment row ──────────────────────────────────────────
    if (orderId) {
      const { error: syncErr } = await supabase
        .from("payments")
        .upsert(
          {
            order_id: orderId,
            provider: "paystack",
            paystack_reference: reference,
            amount: fromKobo(tx.amount),
            currency: tx.currency,
            status: isPaid ? "paid" : tx.status === "abandoned" ? "failed" : "pending",
            paid_at: isPaid ? (tx.paid_at ?? new Date().toISOString()) : null,
            meta: tx as unknown as Record<string, unknown>,
          },
          { onConflict: "paystack_reference" }
        );

      if (syncErr) {
        // Log but don't fail the response — the status is still accurate
        console.error("[verify-payment] DB sync error:", syncErr.message);
      }
    }

    // ── 4. Fetch updated order if we have the id ─────────────────────────
    let order: { id: string; payment_status: string; order_status: string } | null = null;

    if (orderId) {
      const { data } = await supabase
        .from("orders")
        .select("id, payment_status, order_status")
        .eq("id", orderId)
        .single();
      order = data;
    }

    return NextResponse.json({
      reference,
      status: tx.status,           // "success" | "failed" | "abandoned" | "pending"
      paid: isPaid,
      amount_ngn: fromKobo(tx.amount),
      currency: tx.currency,
      channel: tx.channel,
      gateway_response: tx.gateway_response,
      paid_at: tx.paid_at,
      customer: tx.customer,
      order,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error.";
    console.error("[verify-payment]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
