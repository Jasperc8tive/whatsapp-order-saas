"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkPlanLimit, DEFAULT_PLAN, type PlanId } from "@/lib/plans";
import type { OrderStatus } from "@/types/order";
import { notifyOrderCreated, notifyOrderShipped } from "@/lib/whatsapp";
import { logActivity } from "@/lib/activity";
import { enqueueJob } from "@/lib/jobs";

//  Manual order creation (from vendor dashboard) 
export interface ManualOrderInput {
  customerName: string;
  phone: string;
  items: Array<{ product_name: string; quantity: number; price: number }>;
  notes?: string;
}

export async function createManualOrder(
  input: ManualOrderInput
): Promise<{ orderId?: string; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { customerName, phone, items, notes } = input;
  if (!customerName.trim() || !phone.trim()) {
    return { error: "Customer name and phone are required." };
  }
  if (!items.length || items.some((i) => !i.product_name.trim() || i.quantity < 1)) {
    return { error: "Add at least one item with a valid name and quantity." };
  }

  //  Plan limit check 
  const admin = createAdminClient();
  const { data: vendorRow } = await admin
    .from("users")
    .select("business_name")
    .eq("id", user.id)
    .single();

  const planCheck = await checkPlanLimit(
    admin,
    user.id,
    DEFAULT_PLAN as PlanId
  );
  if (!planCheck.allowed) return { error: planCheck.reason ?? "Monthly order limit reached." };

  //  Resolve customer by phone, then update or create (works even without unique constraint) 
  const normalizedPhone = phone.trim();
  const normalizedName = customerName.trim();

  const { data: existingCustomer, error: existingErr } = await admin
    .from("customers")
    .select("id")
    .eq("vendor_id", user.id)
    .eq("phone", normalizedPhone)
    .maybeSingle();

  if (existingErr) return { error: existingErr.message };

  let customerId = existingCustomer?.id as string | undefined;

  if (customerId) {
    const { error: updateCustomerErr } = await admin
      .from("customers")
      .update({ name: normalizedName })
      .eq("id", customerId)
      .eq("vendor_id", user.id);

    if (updateCustomerErr) return { error: updateCustomerErr.message };
  } else {
    const { data: createdCustomer, error: createCustomerErr } = await admin
      .from("customers")
      .insert({ vendor_id: user.id, name: normalizedName, phone: normalizedPhone })
      .select("id")
      .single();

    if (createCustomerErr || !createdCustomer) {
      return { error: createCustomerErr?.message ?? "Failed to save customer." };
    }

    customerId = createdCustomer.id;
  }

  //  Insert order 
  const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.price, 0);

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      vendor_id:      user.id,
      customer_id:    customerId,
      total_amount:   totalAmount,
    })
    .select("id")
    .single();

  if (orderErr || !order) return { error: orderErr?.message ?? "Failed to create order." };

  //  Insert order items (support both `price` and legacy `unit_price`) 
  const itemPayload = items.map((i) => ({
    order_id:     order.id,
    product_name: i.product_name.trim(),
    quantity:     i.quantity,
    price:        i.price,
  }));

  let { error: itemsErr } = await admin.from("order_items").insert(itemPayload);

  if (itemsErr && itemsErr.message.toLowerCase().includes("price")) {
    const legacyPayload = items.map((i) => ({
      order_id:     order.id,
      product_name: i.product_name.trim(),
      quantity:     i.quantity,
      unit_price:   i.price,
    }));

    const retry = await admin.from("order_items").insert(legacyPayload);
    itemsErr = retry.error;
  }

  if (itemsErr && !itemsErr.message.toLowerCase().includes("order_items")) {
    return { error: itemsErr.message };
  }

  //  WhatsApp notification (fire-and-forget) 
  void notifyOrderCreated({
    vendorName:    vendorRow?.business_name ?? "your store",
    customerName:  customerName.trim(),
    customerPhone: phone.trim(),
    orderId:       order.id,
    orderRef:      order.id.slice(0, 8).toUpperCase(),
    items:         items.map((i) => ({ product_name: i.product_name, quantity: i.quantity })),
    address:       "",   // manual orders created from dashboard have no delivery address yet
    notes:         notes ?? null,
  });

  void logActivity({
    workspaceId: user.id,
    actorId: user.id,
    entityType: "order",
    entityId: order.id,
    action: "order_created",
    meta: { source: "manual", total_amount: totalAmount },
  });

  await enqueueJob("automation_event", {
    workspaceId: user.id,
    trigger: "order_created",
    entityType: "order",
    entityId: order.id,
    meta: {
      source: "manual",
      total_amount: totalAmount,
      customer_phone: phone.trim(),
    },
  });

  revalidatePath("/dashboard/orders");
  return { orderId: order.id };
}

//  Update order status (kanban drag) 
export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthenticated" };

  const { error } = await supabase
    .from("orders")
    .update({ order_status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("vendor_id", user.id);   // defence in depth on top of RLS

  // Some deployed schemas use `status` instead of `order_status`.
  if (error && error.message.toLowerCase().includes("order_status")) {
    const { error: legacyError } = await supabase
      .from("orders")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("vendor_id", user.id);

    if (legacyError) return { error: legacyError.message };
  } else if (error) {
    return { error: error.message };
  }

  // Resolve workspace for this order to log activity
  const { data: orderRow } = await createAdminClient()
    .from("orders")
    .select("vendor_id")
    .eq("id", orderId)
    .maybeSingle();

  void logActivity({
    workspaceId: (orderRow?.vendor_id as string | null) ?? user.id,
    actorId: user.id,
    entityType: "order",
    entityId: orderId,
    action: "status_changed",
    meta: { new_status: newStatus },
  });

  await enqueueJob("automation_event", {
    workspaceId: ((orderRow?.vendor_id as string | null) ?? user.id),
    trigger: "order_status_changed",
    entityType: "order",
    entityId: orderId,
    meta: { new_status: newStatus },
  });

  //  WhatsApp notification on "shipped" 
  if (newStatus === "shipped") {
    const admin = createAdminClient();

    const { data: orderRow } = await admin
      .from("orders")
      .select(`id, customers ( name, phone ), deliveries ( courier, tracking_id, delivery_status )`)
      .eq("id", orderId)
      .single();

    const customer   = (orderRow?.customers  as unknown) as { name: string; phone: string } | null;
    const deliveries = (orderRow?.deliveries as unknown) as Array<{
      courier: string | null; tracking_id: string | null; delivery_status: string;
    }> | null;
    const delivery = deliveries?.find((d) => d.delivery_status !== "returned") ?? deliveries?.[0];

    const { data: vendorRow } = await admin
      .from("users")
      .select("business_name")
      .eq("id", user.id)
      .single();

    if (customer?.phone) {
      void notifyOrderShipped({
        customerName:  customer.name,
        customerPhone: customer.phone,
        orderId,
        orderRef:      orderId.slice(0, 8).toUpperCase(),
        vendorName:    vendorRow?.business_name ?? "the vendor",
        courier:       delivery?.courier    ?? null,
        trackingId:    delivery?.tracking_id ?? null,
      });
    }
  }

  return {};
}
