"use server";

import { createAdminClient } from "@/lib/supabaseAdmin";
import { notifyOrderCreated } from "@/lib/whatsapp";
import { checkPlanLimit, DEFAULT_PLAN, type PlanId } from "@/lib/plans";

export interface OrderLineItem {
  product_name: string;
  quantity: number;
}

export interface SubmitOrderInput {
  vendor_slug: string;
  customer_name: string;
  phone: string;
  address: string;
  items: OrderLineItem[];
  notes?: string;
}

export interface SubmitOrderResult {
  orderId?: string;
  orderRef?: string; // Short human-readable ref (first 8 chars of UUID)
  vendorName?: string;
  error?: string;
}

export async function submitOrder(
  input: SubmitOrderInput
): Promise<SubmitOrderResult> {
  // ── Input validation ────────────────────────────────────────────────────
  const { vendor_slug, customer_name, phone, address, items, notes } = input;

  if (!vendor_slug || !customer_name.trim() || !phone.trim() || !address.trim()) {
    return { error: "Please fill in all required fields." };
  }
  if (!items.length || items.some((i) => !i.product_name.trim() || i.quantity < 1)) {
    return { error: "Add at least one item with a valid product name and quantity." };
  }

  const supabase = createAdminClient();

  // ── 1. Resolve vendor by slug ───────────────────────────────────────────
  const { data: vendor, error: vendorErr } = await supabase
    .from("users")
    .select("id, business_name, plan")
    .eq("slug", vendor_slug)
    .single();

  if (vendorErr || !vendor) {
    return { error: "Vendor not found." };
  }

  // ── 1b. Check monthly plan limit ────────────────────────────────────────
  const planCheck = await checkPlanLimit(
    supabase,
    vendor.id,
    (vendor.plan ?? DEFAULT_PLAN) as PlanId
  );
  if (!planCheck.allowed) {
    return { error: planCheck.reason ?? "Order limit reached for this store." };
  }

  // ── 2. Upsert customer (idempotent on phone + vendor_id) ────────────────
  // ON CONFLICT: update name and address so returning customers stay fresh.
  const { data: customer, error: customerErr } = await supabase
    .from("customers")
    .upsert(
      {
        vendor_id: vendor.id,
        name: customer_name.trim(),
        phone: phone.trim(),
        address: address.trim(),
      },
      {
        onConflict: "vendor_id,phone",
        ignoreDuplicates: false, // we want to update name/address on repeat visits
      }
    )
    .select("id")
    .single();

  if (customerErr || !customer) {
    return { error: `Could not save customer: ${customerErr?.message ?? "unknown error"}` };
  }

  // ── 3. Insert order header (total_amount auto-set by DB trigger) ─────────
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      vendor_id: vendor.id,
      customer_id: customer.id,
      order_status: "pending",
      payment_status: "unpaid",
      total_amount: 0,          // trigger recalculates from order_items
      notes: notes?.trim() || null,
    })
    .select("id")
    .single();

  if (orderErr || !order) {
    return { error: `Could not create order: ${orderErr?.message ?? "unknown error"}` };
  }

  // ── 4. Insert order items ───────────────────────────────────────────────
  const orderItems = items.map((item) => ({
    order_id: order.id,
    product_name: item.product_name.trim(),
    quantity: item.quantity,
    price: 0,        // Price to be confirmed by vendor via WhatsApp
  }));

  const { error: itemsErr } = await supabase
    .from("order_items")
    .insert(orderItems);

  if (itemsErr) {
    // Best-effort cleanup: delete the orphaned order
    await supabase.from("orders").delete().eq("id", order.id);
    return { error: `Could not save order items: ${itemsErr.message}` };
  }

  const orderRef = order.id.slice(0, 8).toUpperCase();

  // ── 5. Send WhatsApp notification (fire-and-forget) ─────────────────────
  // notifyOrderCreated catches its own errors — failure won't affect the response.
  notifyOrderCreated({
    customerName: customer_name.trim(),
    customerPhone: phone.trim(),
    orderId: order.id,
    orderRef,
    vendorName: vendor.business_name,
    items,
    address: address.trim(),
    notes,
  });

  return {
    orderId: order.id,
    orderRef,
    vendorName: vendor.business_name,
  };
}
