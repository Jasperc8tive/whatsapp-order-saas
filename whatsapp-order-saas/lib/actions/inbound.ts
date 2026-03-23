/**
 * Inbound message processing — called by the WhatsApp webhook after saving the event.
 *
 * Flow:
 *  1. Load workspace product catalog (with aliases)
 *  2. Parse the message with OpenAI
 *  3. Save ai_parse_attempt
 *  4. Route by confidence:
 *     >= 0.85  → auto-create order
 *     0.55–0.84 → create order_draft for staff review
 *     < 0.55   → reply to customer asking for clarification
 */

import { createAdminClient } from "@/lib/supabaseAdmin";
import { parseOrderFromMessage, type CatalogItem } from "@/lib/ai-parse";
import { sendTextMessage } from "@/lib/whatsapp";
import { enqueueJob } from "@/lib/jobs";

export async function processInboundMessage(
  eventId: string,
  workspaceId: string,
  fromPhone: string,
  messageText: string
): Promise<void> {
  const admin = createAdminClient();

  // 1. Load product catalog for this workspace
  const { data: products } = await admin
    .from("products")
    .select("id, name, is_active")
    .eq("vendor_id", workspaceId)
    .eq("is_active", true);

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
    id:      p.id as string,
    name:    p.name as string,
    aliases: aliasMap[p.id as string] ?? [],
  }));

  // 2. Parse with AI
  const result = await parseOrderFromMessage(messageText, catalog);

  // 3. Save parse attempt
  await admin
    .from("ai_parse_attempts")
    .insert({
      inbound_message_id: eventId,
      workspace_id:       workspaceId,
      model:              process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      confidence:         result.confidence,
      status:             result.status === "parsed"
                            ? "parsed"
                            : result.status === "needs_review"
                              ? "needs_review"
                              : "failed",
      structured_output:  { items: result.items, customer_name: result.customer_name, notes: result.notes },
      error:              result.status === "failed" ? (result.raw_output || "Low confidence") : null,
    });

  // 4. Route by decision
  if (result.decision === "auto_create") {
    await autoCreateOrder(admin, workspaceId, fromPhone, result);
  } else if (result.decision === "needs_review") {
    await createOrderDraft(admin, workspaceId, eventId, fromPhone, result);
  } else {
    // Clarify
    const question = result.clarification_question
      ?? "Hi! Could you please clarify your order? List the items and quantities you'd like.";
    await sendTextMessage(fromPhone, question).catch(() => {/* fire-and-forget */});
  }
}

// ─── Auto-create order ───────────────────────────────────────────────────────

async function autoCreateOrder(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  fromPhone: string,
  result: Awaited<ReturnType<typeof parseOrderFromMessage>>
) {
  // Upsert customer
  const { data: customer } = await admin
    .from("customers")
    .upsert(
      {
        vendor_id: workspaceId,
        phone:     fromPhone,
        name:      result.customer_name ?? fromPhone,
      },
      { onConflict: "vendor_id,phone" }
    )
    .select("id")
    .single();

  if (!customer) return;

  // Calculate total
  const productIds = result.items.map((i) => i.product_id);
  const { data: priceRows } = await admin
    .from("products")
    .select("id, price")
    .in("id", productIds);

  const priceMap: Record<string, number> = {};
  for (const p of priceRows ?? []) priceMap[p.id as string] = Number(p.price ?? 0);

  const total = result.items.reduce(
    (sum, item) => sum + (priceMap[item.product_id] ?? 0) * item.quantity, 0
  );

  // Create order
  const { data: order } = await admin
    .from("orders")
    .insert({
      vendor_id:      workspaceId,
      customer_id:    customer.id,
      order_status:   "pending",
      payment_status: "unpaid",
      total_amount:   total,
      notes:          result.notes,
    })
    .select("id")
    .single();

  if (!order) return;

  // Insert order items
  const itemRows = result.items.map((item) => ({
    order_id:     order.id,
    product_id:   item.product_id,
    product_name: item.product_name,
    quantity:     item.quantity,
    price:        priceMap[item.product_id] ?? 0,
  }));

  await admin.from("order_items").insert(itemRows);

  await enqueueJob("automation_event", {
    workspaceId,
    trigger: "order_created",
    entityType: "order",
    entityId: order.id,
    meta: {
      source: "whatsapp_ai",
      total_amount: total,
      customer_phone: fromPhone,
    },
  });

  // Send confirmation
  const itemsSummary = result.items
    .map((i) => `• ${i.quantity}× ${i.product_name}`)
    .join("\n");

  const orderRef = (order.id as string).slice(0, 8).toUpperCase();
  const msg =
    `✅ Order confirmed! Here's your summary:\n\n${itemsSummary}\n\n` +
    `Order #${orderRef}\nTotal: ₦${total.toLocaleString("en-NG")}\n\n` +
    `We'll update you on your order status shortly. Thank you!`;

  await sendTextMessage(fromPhone, msg).catch(() => {/* fire-and-forget */});
}

// ─── Create draft for staff review ───────────────────────────────────────────

async function createOrderDraft(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  eventId: string,
  fromPhone: string,
  result: Awaited<ReturnType<typeof parseOrderFromMessage>>
) {
  const { data: draft } = await admin
    .from("order_drafts")
    .insert({
      workspace_id:        workspaceId,
      inbound_message_id:  eventId,
      customer_phone:      fromPhone,
      customer_name:       result.customer_name,
      items:               result.items,
      notes:               result.notes,
      confidence:          result.confidence,
      status:              "pending_review",
    })
    .select("id")
    .single();

  if (draft?.id) {
    await enqueueJob("notify_staff_draft", {
      workspaceId,
      draftId: draft.id,
      customerPhone: fromPhone,
      confidence: result.confidence,
      itemCount: result.items.length,
    });
  }

  // Acknowledge receipt to customer while staff reviews
  const msg =
    `👋 Hi! We received your message and our team is reviewing your order. ` +
    `We'll confirm shortly. Thank you for your patience!`;
  await sendTextMessage(fromPhone, msg).catch(() => {/* fire-and-forget */});
}
