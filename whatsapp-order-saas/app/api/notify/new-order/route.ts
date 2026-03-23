/**
 * POST /api/notify/new-order
 *
 * Called by NewOrderModal after a successful Supabase insert.
 * Fetches the vendor's phone number from the users table,
 * then fires a WhatsApp notification.
 *
 * Body: { vendorId, customer_name, phone, product, quantity, orderId }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { sendVendorNewOrderNotification } from "@/lib/sendWhatsAppNotification";

interface NotifyBody {
  vendorId: string;
  customer_name: string;
  phone: string;
  product: string;
  quantity: number;
  orderId: string;
}

export async function POST(req: NextRequest) {
  // ── 1. Parse body ──────────────────────────────────────────────────────────
  let body: NotifyBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { vendorId, customer_name, phone, product, quantity, orderId } = body;

  if (!vendorId || !customer_name || !phone || !product || !quantity || !orderId) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  // ── 2. Authenticate the caller ─────────────────────────────────────────────
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  }

  // Caller must be the vendor — prevents one vendor from triggering
  // notifications on another vendor's orders.
  if (user.id !== vendorId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { data: vendor, error: vendorError } = await supabase
    .from("users")
    .select("phone, business_name")
    .eq("id", vendorId)
    .single();

  if (vendorError || !vendor) {
    console.error("[notify/new-order] Could not fetch vendor:", vendorError?.message);
    // Don't block — return 200 so the modal doesn't surface a false error to the user
    return NextResponse.json({ ok: false, reason: "Vendor not found." });
  }

  if (!vendor.phone) {
    console.warn(
      `[notify/new-order] Vendor ${vendorId} has no phone number — notification skipped.`
    );
    return NextResponse.json({ ok: false, reason: "No WhatsApp number on vendor profile." });
  }

  // ── 3. Send notification ───────────────────────────────────────────────────
  const result = await sendVendorNewOrderNotification({
    vendorWhatsappNumber: vendor.phone,
    customerName: customer_name,
    customerPhone: phone,
    product,
    quantity,
    orderId,
  });

  if (!result.ok) {
    console.error("[notify/new-order] WhatsApp send failed:", result.error);
    // Still return 200 — a failed notification is not a fatal order error
    return NextResponse.json({ ok: false, error: result.error });
  }

  return NextResponse.json({ ok: true, messageId: result.messageId });
}
