"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import {
  checkPlanLimit,
  DEFAULT_PLAN,
  getWorkspacePlan,
  hasAiInboxCopilotAccess,
  type PlanId,
} from "@/lib/plans";
import type { OrderStatus } from "@/types/order";
import { notifyOrderCreated, notifyOrderShipped } from "@/lib/whatsapp";
import { logActivity } from "@/lib/activity";
import { enqueueJob } from "@/lib/jobs";
import { parseOrderFromMessage, type CatalogItem } from "@/lib/ai-parse";
import {
  getCurrentWorkspaceId,
  getCurrentWorkspaceRole,
  assertWorkspaceRole,
  canWriteOrder,
  canUpdateOrderDelivery,
} from "@/lib/workspace";

//  Manual order creation (from vendor dashboard) 
export interface ManualOrderInput {
  customerName: string;
  phone: string;
  items: Array<{ product_name: string; quantity: number; price: number }>;
  notes?: string;
}

export interface ManualOrderAutofillResult {
  customerName: string;
  phone: string;
  notes: string;
  items: Array<{ product_name: string; quantity: number; price: number }>;
  confidence: number;
}

export async function createManualOrder(
  input: ManualOrderInput
): Promise<{ orderId?: string; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Check role: only owner and staff can create orders
  if (!(await canWriteOrder(user.id))) {
    return { error: "Only workspace owner and staff can create orders." };
  }

  const { customerName, phone, items, notes } = input;
  if (!customerName.trim() || !phone.trim()) {
    return { error: "Customer name and phone are required." };
  }
  if (!items.length || items.some((i) => !i.product_name.trim() || i.quantity < 1)) {
    return { error: "Add at least one item with a valid name and quantity." };
  }

  // Get workspace ID for this user
  const workspaceId = await getCurrentWorkspaceId(user.id);
  if (!workspaceId) {
    return { error: "Could not determine your workspace." };
  }

  //  Plan limit check 
  const admin = createAdminClient();
  const { data: vendorRow } = await admin
    .from("users")
    .select("business_name")
    .eq("id", workspaceId)
    .single();

  const planCheck = await checkPlanLimit(
    admin,
    workspaceId,
    DEFAULT_PLAN as PlanId
  );
  if (!planCheck.allowed) return { error: planCheck.reason ?? "Monthly order limit reached." };

  //  Resolve customer by phone, then update or create (works even without unique constraint) 
  const normalizedPhone = phone.trim();
  const normalizedName = customerName.trim();

  const { data: existingCustomer, error: existingErr } = await admin
    .from("customers")
    .select("id")
    .eq("vendor_id", workspaceId)
    .eq("phone", normalizedPhone)
    .maybeSingle();

  if (existingErr) return { error: existingErr.message };

  let customerId = existingCustomer?.id as string | undefined;

  if (customerId) {
    const { error: updateCustomerErr } = await admin
      .from("customers")
      .update({ name: normalizedName })
      .eq("id", customerId)
      .eq("vendor_id", workspaceId);

    if (updateCustomerErr) return { error: updateCustomerErr.message };
  } else {
    const { data: createdCustomer, error: createCustomerErr } = await admin
      .from("customers")
      .insert({ vendor_id: workspaceId, name: normalizedName, phone: normalizedPhone })
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
      vendor_id:      workspaceId,
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
    workspaceId: workspaceId,
    actorId: user.id,
    entityType: "order",
    entityId: order.id,
    action: "order_created",
    meta: { source: "manual", total_amount: totalAmount },
  });

  await enqueueJob("automation_event", {
    workspaceId: workspaceId,
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

function extractPhoneFromText(text: string): string {
  const matches = text.match(/(\+?\d[\d\s()-]{8,}\d)/g);
  if (!matches || matches.length === 0) return "";

  const normalized = matches[0].replace(/[^\d+]/g, "");
  return normalized.startsWith("+") ? normalized : normalized;
}

export async function autofillManualOrderFromChat(
  chatText: string
): Promise<{ data?: ManualOrderAutofillResult; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  if (!(await canWriteOrder(user.id))) {
    return { error: "Only workspace owner and staff can create orders." };
  }

  const trimmed = chatText.trim();
  if (!trimmed) return { error: "Paste a customer message to use AI autofill." };

  const workspaceId = await getCurrentWorkspaceId(user.id);
  if (!workspaceId) return { error: "Could not determine your workspace." };

  const admin = createAdminClient();
  const currentPlanId = await getWorkspacePlan(admin, workspaceId);
  if (!hasAiInboxCopilotAccess(currentPlanId)) {
    return { error: "Chat-to-order autofill is available on the Pro plan only." };
  }

  const { data: products } = await admin
    .from("products")
    .select("id, name, price")
    .eq("vendor_id", workspaceId)
    .eq("is_active", true);

  if (!products || products.length === 0) {
    return { error: "No active products found. Add products first before using AI autofill." };
  }

  const { data: aliasRows } = await admin
    .from("product_aliases")
    .select("product_id, alias")
    .eq("workspace_id", workspaceId);

  const aliasMap: Record<string, string[]> = {};
  for (const row of aliasRows ?? []) {
    const pid = row.product_id as string;
    if (!aliasMap[pid]) aliasMap[pid] = [];
    aliasMap[pid].push(row.alias as string);
  }

  const catalog: CatalogItem[] = (products ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    aliases: aliasMap[p.id as string] ?? [],
    price: Number(p.price ?? 0),
  }));

  const result = await parseOrderFromMessage(trimmed, catalog);
  if (!result.items.length) {
    return {
      error:
        result.clarification_question ??
        "Could not confidently extract order items from this message. Please edit manually.",
    };
  }

  const priceMap: Record<string, number> = {};
  for (const p of products ?? []) priceMap[p.id as string] = Number(p.price ?? 0);

  const detectedPhone = extractPhoneFromText(trimmed);

  return {
    data: {
      customerName: result.customer_name ?? "",
      phone: detectedPhone,
      notes: result.notes ?? "",
      confidence: result.confidence,
      items: result.items.map((item) => ({
        product_name: item.product_name,
        quantity: item.quantity,
        price: priceMap[item.product_id] ?? 0,
      })),
    },
  };
}

//  Update order status (kanban drag) 
export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthenticated" };

  // Check role: all roles can update delivery-related fields
  if (!(await canUpdateOrderDelivery(user.id))) {
    return { error: "Not authorized to update order status." };
  }

  const workspaceId = await getCurrentWorkspaceId(user.id);
  if (!workspaceId) {
    return { error: "Workspace not found." };
  }

  // First verify the order belongs to the user's workspace
  const admin = createAdminClient();
  const { data: orderRow } = await admin
    .from("orders")
    .select("vendor_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!orderRow || orderRow.vendor_id !== workspaceId) {
    return { error: "Order not found or not in your workspace." };
  }

  const { error } = await supabase
    .from("orders")
    .update({ order_status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("vendor_id", workspaceId);   // defence in depth on top of RLS

  // Some deployed schemas use `status` instead of `order_status`.
  if (error && error.message.toLowerCase().includes("order_status")) {
    const { error: legacyError } = await supabase
      .from("orders")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("vendor_id", workspaceId);

    if (legacyError) return { error: legacyError.message };
  } else if (error) {
    return { error: error.message };
  }

  void logActivity({
    workspaceId: workspaceId,
    actorId: user.id,
    entityType: "order",
    entityId: orderId,
    action: "status_changed",
    meta: { new_status: newStatus },
  });

  await enqueueJob("automation_event", {
    workspaceId: workspaceId,
    trigger: "order_status_changed",
    entityType: "order",
    entityId: orderId,
    meta: { new_status: newStatus },
  });

  //  WhatsApp notification on "shipped" 
  if (newStatus === "shipped") {
    const adminClient = createAdminClient();

    const { data: shippedOrderRow } = await adminClient
      .from("orders")
      .select(`id, customers ( name, phone ), deliveries ( courier, tracking_id, delivery_status )`)
      .eq("id", orderId)
      .single();

    const customer   = (shippedOrderRow?.customers  as unknown) as { name: string; phone: string } | null;
    const deliveries = (shippedOrderRow?.deliveries as unknown) as Array<{
      courier: string | null; tracking_id: string | null; delivery_status: string;
    }> | null;
    const delivery = deliveries?.find((d) => d.delivery_status !== "returned") ?? deliveries?.[0];

    const { data: vendorRow } = await adminClient
      .from("users")
      .select("business_name")
      .eq("id", workspaceId)
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
