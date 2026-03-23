"use server";

import { createAdminClient } from "@/lib/supabaseAdmin";
import { notifyOrderCreated } from "@/lib/whatsapp";
import { checkPlanLimit, DEFAULT_PLAN, type PlanId } from "@/lib/plans";
import { DEMO_VENDOR, DEMO_VENDOR_SLUG } from "@/lib/demoStore";

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

  // Demo storefront uses a synthetic success response and does not persist data.
  if (vendor_slug === DEMO_VENDOR_SLUG) {
    const orderId = crypto.randomUUID();
    return {
      orderId,
      orderRef: orderId.slice(0, 8).toUpperCase(),
      vendorName: DEMO_VENDOR.business_name,
    };
  }

  const supabase = createAdminClient();

  // ── 1. Resolve vendor by slug ───────────────────────────────────────────
  const { data: vendor, error: vendorErr } = await supabase
    .from("users")
    .select("id, business_name")
    .eq("slug", vendor_slug)
    .single();

  if (vendorErr || !vendor) {
    return { error: "Vendor not found." };
  }

  // ── 1b. Check monthly plan limit ────────────────────────────────────────
  const planCheck = await checkPlanLimit(
    supabase,
    vendor.id,
    DEFAULT_PLAN as PlanId
  );
  if (!planCheck.allowed) {
    return { error: planCheck.reason ?? "Order limit reached for this store." };
  }

  // ── 2. Resolve customer by phone, then update or create ─────────────────
  const normalizedPhone = phone.trim();
  const normalizedName = customer_name.trim();
  const normalizedAddress = address.trim();

  const { data: existingCustomer, error: existingErr } = await supabase
    .from("customers")
    .select("id")
    .eq("vendor_id", vendor.id)
    .eq("phone", normalizedPhone)
    .maybeSingle();

  if (existingErr) {
    return { error: `Could not lookup customer: ${existingErr.message}` };
  }

  let customerId = existingCustomer?.id as string | undefined;

  if (customerId) {
    const { error: updateCustomerErr } = await supabase
      .from("customers")
      .update({ name: normalizedName, address: normalizedAddress })
      .eq("id", customerId)
      .eq("vendor_id", vendor.id);

    if (updateCustomerErr) {
      return { error: `Could not update customer: ${updateCustomerErr.message}` };
    }
  } else {
    const { data: createdCustomer, error: createCustomerErr } = await supabase
      .from("customers")
      .insert({
        vendor_id: vendor.id,
        name: normalizedName,
        phone: normalizedPhone,
        address: normalizedAddress,
      })
      .select("id")
      .single();

    if (createCustomerErr || !createdCustomer) {
      return { error: `Could not save customer: ${createCustomerErr?.message ?? "unknown error"}` };
    }

    customerId = createdCustomer.id;
  }

  // ── 3. Insert order header (total_amount auto-set by DB trigger) ─────────
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      vendor_id: vendor.id,
      customer_id: customerId,
      total_amount: 0,          // trigger recalculates from order_items
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

  let { error: itemsErr } = await supabase
    .from("order_items")
    .insert(orderItems);

  if (itemsErr && itemsErr.message.toLowerCase().includes("price")) {
    const legacyItems = items.map((item) => ({
      order_id: order.id,
      product_name: item.product_name.trim(),
      quantity: item.quantity,
      unit_price: 0,
    }));

    const retry = await supabase.from("order_items").insert(legacyItems);
    itemsErr = retry.error;
  }

  if (itemsErr && !itemsErr.message.toLowerCase().includes("order_items")) {
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
