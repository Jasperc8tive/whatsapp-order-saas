"use server";

import { revalidatePath } from "next/cache";
import OpenAI from "openai";
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

export interface SmartReplySuggestionResult {
  suggestions: string[];
  confidence: number;
}

export type SmartReplyUsageEvent = "generated" | "copied" | "whatsapp_clicked";

export type SentimentType = "positive" | "neutral" | "negative";

export interface SentimentAnalysisResult {
  sentiment: SentimentType;
  confidence: number;
  reason?: string;
}

export interface ProductRecommendation {
  productId: string;
  productName: string;
  price: number;
  reason: string;
  confidence: number;
  suggestedQuantity: number;   // derived from customer's past order quantities
}

export interface ProductRecommendationsResult {
  recommendations: ProductRecommendation[];
  confidence: number;
}

export type ProductRecommendationUsageEvent = "impression" | "accepted" | "catalog_click";

const SMART_REPLY_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

function getSmartReplyClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY env var.");
  return new OpenAI({ apiKey });
}

function buildFallbackSmartReplies(status: OrderStatus, customerName: string): string[] {
  const name = customerName || "there";

  if (status === "pending") {
    return [
      `Hi ${name}, thanks for your order. We have received it and will confirm shortly.`,
      `Hello ${name}, your order is in our queue and we will update you as soon as it is confirmed.`,
      `Thanks ${name}. We are reviewing your order now and will share the next update soon.`,
    ];
  }

  if (status === "confirmed") {
    return [
      `Hi ${name}, your order is confirmed and we are preparing it now.`,
      `Hello ${name}, payment is confirmed. We will notify you once your order is ready for dispatch.`,
      `Thanks ${name}, your order has been confirmed and prep is underway.`,
    ];
  }

  if (status === "processing") {
    return [
      `Hi ${name}, your order is currently being prepared and we will share an update soon.`,
      `Hello ${name}, we are processing your order right now and it should be ready shortly.`,
      `Thanks for your patience ${name}. Your order is in progress.`,
    ];
  }

  if (status === "shipped") {
    return [
      `Hi ${name}, your order has been shipped and is on the way.`,
      `Hello ${name}, dispatch is complete. Your delivery is currently in transit.`,
      `Good news ${name}, your order is out for delivery.`,
    ];
  }

  if (status === "delivered") {
    return [
      `Hi ${name}, we hope you received your order well. Thank you for choosing us.`,
      `Hello ${name}, your order was delivered. Please let us know if everything is okay.`,
      `Thanks ${name}. Your order is marked delivered. We appreciate your patronage.`,
    ];
  }

  return [
    `Hi ${name}, thanks for reaching out. We are checking your order update now.`,
    `Hello ${name}, we are reviewing your request and will respond shortly.`,
    `Thanks ${name}, we have noted your message and will assist right away.`,
  ];
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

export async function generateProductRecommendations(
  customerId: string
): Promise<{ data?: ProductRecommendationsResult; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const workspaceId = await getCurrentWorkspaceId(user.id);
  if (!workspaceId) return { error: "Could not determine your workspace." };

  const admin = createAdminClient();
  const currentPlanId = await getWorkspacePlan(admin, workspaceId);
  if (!hasAiInboxCopilotAccess(currentPlanId)) {
    return { error: "Product recommendations are available on the Pro plan only." };
  }

  const { data: pastOrders } = await admin
    .from("orders")
    .select("id")
    .eq("customer_id", customerId)
    .eq("vendor_id", workspaceId)
    .limit(10);

  if (!pastOrders || pastOrders.length === 0) {
    return {
      data: {
        recommendations: [],
        confidence: 0,
      },
    };
  }

  const { data: pastItems } = await admin
    .from("order_items")
    .select("product_name, quantity")
    .in("order_id", pastOrders.map((order) => order.id as string));

  // Build a map of product name (lowercase) → list of past quantities for suggested qty
  const qtyHistoryMap = new Map<string, number[]>();
  for (const item of pastItems ?? []) {
    const key = (item.product_name as string).toLowerCase();
    if (!qtyHistoryMap.has(key)) qtyHistoryMap.set(key, []);
    qtyHistoryMap.get(key)!.push(Number(item.quantity ?? 1));
  }

  function historicalAvgQty(productName: string): number {
    const qtys = qtyHistoryMap.get(productName.toLowerCase()) ?? [];
    if (!qtys.length) return 1;
    const avg = qtys.reduce((s, q) => s + q, 0) / qtys.length;
    return Math.max(1, Math.round(avg));
  }

  const purchaseHistory = (pastItems ?? [])
    .map((item) => item.product_name)
    .filter(Boolean)
    .join(", ");

  const { data: allProducts } = await admin
    .from("products")
    .select("id, name, price")
    .eq("vendor_id", workspaceId)
    .eq("is_active", true)
    .limit(50);

  if (!allProducts || allProducts.length === 0) {
    return {
      data: {
        recommendations: [],
        confidence: 0,
      },
    };
  }

  const productList = allProducts
    .map((product) => `${product.name} (${product.id})`)
    .join(", ");
  const productById = new Map(
    allProducts.map((product) => [product.id as string, Number(product.price ?? 0)])
  );

  try {
    const client = getSmartReplyClient();
    const completion = await client.chat.completions.create({
      model: SMART_REPLY_MODEL,
      temperature: 0.4,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You recommend complementary products based on customer purchase history. Return strict JSON with recommendations array containing {productId, productName, reason, confidence}. Max 3 recommendations.",
        },
        {
          role: "user",
          content: JSON.stringify({
            customer_purchase_history: purchaseHistory || "No purchase history available",
            available_products: productList,
            recommendation_count: 3,
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw) as {
      recommendations?: Array<{
        productId?: string;
        productName?: string;
        reason?: string;
        confidence?: number;
      }>;
    };

    const validProductIds = new Set(allProducts.map((product) => product.id as string));
    const recommendations = (parsed.recommendations ?? [])
      .filter((recommendation) => recommendation.productId && recommendation.productName)
      .map((recommendation) => ({
        productId: recommendation.productId ?? "",
        productName: recommendation.productName ?? "",
        price: productById.get(recommendation.productId ?? "") ?? 0,
        reason: (recommendation.reason ?? "").slice(0, 100),
        confidence: Math.max(0, Math.min(1, Number(recommendation.confidence ?? 0.7))),
        suggestedQuantity: historicalAvgQty(recommendation.productName ?? ""),
      }))
      .filter((recommendation) => validProductIds.has(recommendation.productId))
      .slice(0, 3);

    const avgConfidence = recommendations.length > 0
      ? recommendations.reduce((sum, recommendation) => sum + recommendation.confidence, 0) / recommendations.length
      : 0;

    await logActivity({
      workspaceId,
      actorId: user.id,
      entityType: "customer",
      entityId: customerId,
      action: "product_recommendations_generated",
      meta: {
        source: "ai",
        recommendation_count: recommendations.length,
      },
    });

    return {
      data: {
        recommendations,
        confidence: avgConfidence,
      },
    };
  } catch {
    await logActivity({
      workspaceId,
      actorId: user.id,
      entityType: "customer",
      entityId: customerId,
      action: "product_recommendations_generated",
      meta: {
        source: "fallback_error",
      },
    });

    return {
      data: {
        recommendations: [],
        confidence: 0,
      },
    };
  }
}

export async function trackProductRecommendationUsage(
  customerId: string,
  event: ProductRecommendationUsageEvent,
  meta?: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const workspaceId = await getCurrentWorkspaceId(user.id);
  if (!workspaceId) return { ok: false, error: "Could not determine your workspace." };

  const admin = createAdminClient();
  const currentPlanId = await getWorkspacePlan(admin, workspaceId);
  if (!hasAiInboxCopilotAccess(currentPlanId)) {
    return { ok: false, error: "Product recommendations are available on the Pro plan only." };
  }

  const { data: customerRow } = await admin
    .from("customers")
    .select("id, vendor_id")
    .eq("id", customerId)
    .maybeSingle();

  if (!customerRow || customerRow.vendor_id !== workspaceId) {
    return { ok: false, error: "Customer not found or not in your workspace." };
  }

  const actionName =
    event === "accepted"      ? "product_recommendation_accepted" :
    event === "catalog_click" ? "product_recommendation_catalog_click" :
                                "product_recommendation_impression";

  await logActivity({
    workspaceId,
    actorId: user.id,
    entityType: "customer",
    entityId: customerId,
    action: actionName,
    meta: meta ?? {},
  });

  return { ok: true };
}

export async function generateSmartReplySuggestions(
  orderId: string,
  customerMessage?: string,
  surface: "kanban_card" | "order_detail" = "kanban_card"
): Promise<{ data?: SmartReplySuggestionResult; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const workspaceId = await getCurrentWorkspaceId(user.id);
  if (!workspaceId) return { error: "Could not determine your workspace." };

  const admin = createAdminClient();
  const currentPlanId = await getWorkspacePlan(admin, workspaceId);
  if (!hasAiInboxCopilotAccess(currentPlanId)) {
    return { error: "Smart replies are available on the Pro plan only." };
  }

  const { data: orderRow } = await admin
    .from("orders")
    .select("id, vendor_id, customer_id, status, order_status")
    .eq("id", orderId)
    .maybeSingle();

  if (!orderRow || orderRow.vendor_id !== workspaceId) {
    return { error: "Order not found or not in your workspace." };
  }

  const status = ((orderRow.order_status ?? orderRow.status ?? "pending") as OrderStatus);
  const customerId = (orderRow.customer_id as string | null) ?? "";

  const [{ data: customer }, { data: orderItems }, { data: vendor }] = await Promise.all([
    customerId
      ? admin
          .from("customers")
          .select("name, phone")
          .eq("id", customerId)
          .maybeSingle()
      : Promise.resolve({ data: null as { name: string; phone: string } | null }),
    admin
      .from("order_items")
      .select("product_name, quantity")
      .eq("order_id", orderId),
    admin
      .from("users")
      .select("business_name")
      .eq("id", workspaceId)
      .maybeSingle(),
  ]);

  const customerName = customer?.name ?? "Customer";
  const vendorName = vendor?.business_name ?? "our store";
  const itemList = (orderItems ?? [])
    .map((item) => `${Number(item.quantity ?? 1)}x ${(item.product_name as string) ?? "Item"}`)
    .join(", ");

  const fallback = buildFallbackSmartReplies(status, customerName);

  try {
    const client = getSmartReplyClient();
    const completion = await client.chat.completions.create({
      model: SMART_REPLY_MODEL,
      temperature: 0.45,
      max_tokens: 550,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You create concise WhatsApp customer support replies for order updates. Return strict JSON only with keys suggestions and confidence. suggestions must contain exactly 3 unique strings, each under 220 characters.",
        },
        {
          role: "user",
          content: JSON.stringify({
            customer_name: customerName,
            vendor_name: vendorName,
            order_status: status,
            order_items: itemList || "Not available",
            latest_customer_message: customerMessage?.trim() || null,
            tone: "warm, clear, professional",
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw) as { suggestions?: string[]; confidence?: number };

    const suggestions = (parsed.suggestions ?? [])
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 3);

    if (suggestions.length < 3) {
      const data = { suggestions: fallback, confidence: 0.55 };
      await logActivity({
        workspaceId,
        actorId: user.id,
        entityType: "order",
        entityId: orderId,
        action: "smart_reply_generated",
        meta: {
          source: "fallback",
          surface,
          confidence: data.confidence,
          suggestions_count: data.suggestions.length,
        },
      });
      return { data };
    }

    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.78)));
    await logActivity({
      workspaceId,
      actorId: user.id,
      entityType: "order",
      entityId: orderId,
      action: "smart_reply_generated",
      meta: {
        source: "ai",
        surface,
        confidence,
        suggestions_count: suggestions.length,
      },
    });

    return { data: { suggestions, confidence } };
  } catch {
    const data = { suggestions: fallback, confidence: 0.42 };
    await logActivity({
      workspaceId,
      actorId: user.id,
      entityType: "order",
      entityId: orderId,
      action: "smart_reply_generated",
      meta: {
        source: "fallback_error",
        surface,
        confidence: data.confidence,
        suggestions_count: data.suggestions.length,
      },
    });
    return { data };
  }
}

export async function trackSmartReplyUsage(
  orderId: string,
  event: SmartReplyUsageEvent,
  meta?: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const workspaceId = await getCurrentWorkspaceId(user.id);
  if (!workspaceId) return { ok: false, error: "Could not determine your workspace." };

  const admin = createAdminClient();
  const currentPlanId = await getWorkspacePlan(admin, workspaceId);
  if (!hasAiInboxCopilotAccess(currentPlanId)) {
    return { ok: false, error: "Smart replies are available on the Pro plan only." };
  }

  const { data: orderRow } = await admin
    .from("orders")
    .select("id, vendor_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!orderRow || orderRow.vendor_id !== workspaceId) {
    return { ok: false, error: "Order not found or not in your workspace." };
  }

  const action =
    event === "copied"
      ? "smart_reply_copied"
      : event === "whatsapp_clicked"
      ? "smart_reply_whatsapp_clicked"
      : "smart_reply_generated";

  await logActivity({
    workspaceId,
    actorId: user.id,
    entityType: "order",
    entityId: orderId,
    action,
    meta: meta ?? {},
  });

  return { ok: true };
}

export async function generateOrderSummary(
  orderId: string
): Promise<{ data?: string; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const workspaceId = await getCurrentWorkspaceId(user.id);
  if (!workspaceId) return { error: "Could not determine your workspace." };

  const admin = createAdminClient();
  const currentPlanId = await getWorkspacePlan(admin, workspaceId);
  if (!hasAiInboxCopilotAccess(currentPlanId)) {
    return { error: "Order summaries are available on the Pro plan only." };
  }

  const { data: orderRow } = await admin
    .from("orders")
    .select("id, vendor_id, customer_id, status, order_status, notes, total_amount, total, created_at")
    .eq("id", orderId)
    .maybeSingle();

  if (!orderRow || orderRow.vendor_id !== workspaceId) {
    return { error: "Order not found or not in your workspace." };
  }

  const status = ((orderRow.order_status ?? orderRow.status ?? "pending") as OrderStatus);
  const customerId = (orderRow.customer_id as string | null) ?? "";
  const totalAmount = Number((orderRow.total_amount ?? orderRow.total ?? 0) as number);

  const [{ data: customer }, { data: orderItems }, { data: vendor }] = await Promise.all([
    customerId
      ? admin
          .from("customers")
          .select("name, phone")
          .eq("id", customerId)
          .maybeSingle()
      : Promise.resolve({ data: null as { name: string; phone: string } | null }),
    admin
      .from("order_items")
      .select("product_name, quantity, price, subtotal")
      .eq("order_id", orderId),
    admin
      .from("users")
      .select("business_name")
      .eq("id", workspaceId)
      .maybeSingle(),
  ]);

  const customerName = customer?.name ?? "Customer";
  const vendorName = vendor?.business_name ?? "Our Store";
  const itemList = (orderItems ?? [])
    .map((item) => {
      const qty = Number(item.quantity ?? 1);
      const name = (item.product_name as string) ?? "Item";
      const price = Number(item.price ?? 0);
      return `${qty}x ${name} (${formatCurrency(price)} each)`;
    })
    .join(", ");

  const createdDate = new Date(orderRow.created_at as string).toLocaleDateString();

  const fallbackSummary = `Order #${orderId.slice(0, 8).toUpperCase()} placed on ${createdDate} for ${customerName}. Items: ${itemList || "Not specified"}. Total: ${formatCurrency(totalAmount)}. Status: ${status.charAt(0).toUpperCase() + status.slice(1)}.`;

  try {
    const client = getSmartReplyClient();
    const completion = await client.chat.completions.create({
      model: SMART_REPLY_MODEL,
      temperature: 0.3,
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant summarizing e-commerce orders for shop managers. Provide a concise, professional one or two sentence summary of the order details.",
        },
        {
          role: "user",
          content: JSON.stringify({
            order_id: orderId.slice(0, 8).toUpperCase(),
            customer_name: customerName,
            vendor_name: vendorName,
            items: itemList || "Not specified",
            total_amount: formatCurrency(totalAmount),
            status,
            notes: (orderRow.notes as string) || null,
            created_at: createdDate,
          }),
        },
      ],
    });

    const summary = completion.choices[0]?.message?.content?.trim() ?? fallbackSummary;

    await logActivity({
      workspaceId,
      actorId: user.id,
      entityType: "order",
      entityId: orderId,
      action: "order_summary_generated",
      meta: {
        source: "ai",
      },
    });

    return { data: summary };
  } catch {
    await logActivity({
      workspaceId,
      actorId: user.id,
      entityType: "order",
      entityId: orderId,
      action: "order_summary_generated",
      meta: {
        source: "fallback_error",
      },
    });
    return { data: fallbackSummary };
    }
  }

  export async function analyzeSentiment(
    customerMessage: string
  ): Promise<{ data?: SentimentAnalysisResult; error?: string }> {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated." };

    const workspaceId = await getCurrentWorkspaceId(user.id);
    if (!workspaceId) return { error: "Could not determine your workspace." };

    const admin = createAdminClient();
    const currentPlanId = await getWorkspacePlan(admin, workspaceId);
    if (!hasAiInboxCopilotAccess(currentPlanId)) {
      return { error: "Sentiment analysis is available on the Pro plan only." };
    }

    const trimmed = customerMessage.trim();
    if (!trimmed || trimmed.length < 3) {
      return { error: "Message too short to analyze." };
    }

    try {
      const client = getSmartReplyClient();
      const completion = await client.chat.completions.create({
        model: SMART_REPLY_MODEL,
        temperature: 0.2,
        max_tokens: 100,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Analyze the sentiment of a customer message. Return strict JSON only with keys: sentiment (positive/neutral/negative), confidence (0-1), and reason (brief phrase, max 30 chars).",
          },
          {
            role: "user",
            content: customerMessage,
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? "";
      const parsed = JSON.parse(raw) as {
        sentiment?: string;
        confidence?: number;
        reason?: string;
      };

      const sentiment = (
        ["positive", "neutral", "negative"].includes(parsed.sentiment ?? "")
          ? (parsed.sentiment as SentimentType)
          : "neutral"
      );
      const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.7)));
      const reason = (parsed.reason ?? "").slice(0, 30);

      return {
        data: {
          sentiment,
          confidence,
          reason: reason || undefined,
        },
      };
    } catch {
      return {
        data: {
          sentiment: "neutral",
          confidence: 0.0,
          reason: "Analysis unavailable",
        },
      };
    }
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
