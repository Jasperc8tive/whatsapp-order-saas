"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { logActivity } from "@/lib/activity";
import { enqueueJob } from "@/lib/jobs";
import { getWorkspacePlan, hasAiInboxCopilotAccess } from "@/lib/plans";
import { notifyDraftRejected } from "@/lib/whatsapp";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DraftItem {
  product_id: string;
  product_name: string;
  quantity: number;
}

export interface OrderDraft {
  id: string;
  workspace_id: string;
  inbound_message_id: string | null;
  customer_phone: string;
  customer_name: string | null;
  items: DraftItem[];
  notes: string | null;
  confidence: number | null;
  status: "pending_review" | "approved" | "rejected" | "converted";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_order_id: string | null;
  created_at: string;
  // enriched fields
  message_text?: string | null;
}

// ─── List drafts ──────────────────────────────────────────────────────────────

export async function listDrafts(
  status?: "pending_review" | "approved" | "rejected" | "converted"
): Promise<{ drafts?: OrderDraft[]; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const workspaceId = await resolveWorkspaceId(admin, user.id);
  if (!workspaceId) return { error: "Workspace not found." };
  const access = await assertAiAccess(admin, workspaceId);
  if (!access.ok) return { error: access.error };

  let query = admin
    .from("order_drafts")
    .select("*, inbound_message_events(message_text)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return { error: error.message };

  const drafts: OrderDraft[] = (data ?? []).map((row) => ({
    id:                   row.id as string,
    workspace_id:         row.workspace_id as string,
    inbound_message_id:   row.inbound_message_id as string | null,
    customer_phone:       row.customer_phone as string,
    customer_name:        row.customer_name as string | null,
    items:                (row.items as DraftItem[]) ?? [],
    notes:                row.notes as string | null,
    confidence:           row.confidence !== null ? Number(row.confidence) : null,
    status:               row.status as OrderDraft["status"],
    reviewed_by:          row.reviewed_by as string | null,
    reviewed_at:          row.reviewed_at as string | null,
    created_order_id:     row.created_order_id as string | null,
    created_at:           row.created_at as string,
    message_text:         (row as { inbound_message_events?: { message_text?: string } })
                            .inbound_message_events?.message_text ?? null,
  }));

  return { drafts };
}

// ─── Get single draft ─────────────────────────────────────────────────────────

export async function getDraft(
  draftId: string
): Promise<{ draft?: OrderDraft; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const workspaceId = await resolveWorkspaceId(admin, user.id);
  if (!workspaceId) return { error: "Workspace not found." };
  const access = await assertAiAccess(admin, workspaceId);
  if (!access.ok) return { error: access.error };

  const { data, error } = await admin
    .from("order_drafts")
    .select("*, inbound_message_events(message_text)")
    .eq("id", draftId)
    .eq("workspace_id", workspaceId)
    .single();

  if (error || !data) return { error: "Draft not found." };

  return {
    draft: {
      id:                   data.id as string,
      workspace_id:         data.workspace_id as string,
      inbound_message_id:   data.inbound_message_id as string | null,
      customer_phone:       data.customer_phone as string,
      customer_name:        data.customer_name as string | null,
      items:                (data.items as DraftItem[]) ?? [],
      notes:                data.notes as string | null,
      confidence:           data.confidence !== null ? Number(data.confidence) : null,
      status:               data.status as OrderDraft["status"],
      reviewed_by:          data.reviewed_by as string | null,
      reviewed_at:          data.reviewed_at as string | null,
      created_order_id:     data.created_order_id as string | null,
      created_at:           data.created_at as string,
      message_text:         (data as { inbound_message_events?: { message_text?: string } })
                              .inbound_message_events?.message_text ?? null,
    },
  };
}

// ─── Approve draft → convert to real order ────────────────────────────────────

export async function approveDraft(
  draftId: string
): Promise<{ orderId?: string; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const workspaceId = await resolveWorkspaceId(admin, user.id);
  if (!workspaceId) return { error: "Workspace not found." };
  const access = await assertAiAccess(admin, workspaceId);
  if (!access.ok) return { error: access.error };

  const { data: draft, error: fetchErr } = await admin
    .from("order_drafts")
    .select("*")
    .eq("id", draftId)
    .eq("workspace_id", workspaceId)
    .eq("status", "pending_review")
    .single();

  if (fetchErr || !draft) return { error: "Draft not found or already processed." };

  const items = (draft.items as DraftItem[]) ?? [];
  if (items.length === 0) return { error: "Draft has no items to convert." };

  // Upsert customer
  const { data: customer, error: customerErr } = await admin
    .from("customers")
    .upsert(
      {
        vendor_id: workspaceId,
        phone:     draft.customer_phone as string,
        name:      (draft.customer_name as string) ?? (draft.customer_phone as string),
      },
      { onConflict: "vendor_id,phone" }
    )
    .select("id")
    .single();

  if (customerErr || !customer) return { error: "Failed to upsert customer." };

  // Calculate total
  const productIds = items.map((i) => i.product_id);
  const { data: priceRows } = await admin
    .from("products")
    .select("id, price")
    .in("id", productIds);

  const priceMap: Record<string, number> = {};
  for (const p of priceRows ?? []) priceMap[p.id as string] = Number(p.price ?? 0);

  const total = items.reduce(
    (sum, item) => sum + (priceMap[item.product_id] ?? 0) * item.quantity, 0
  );

  // Create order
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      vendor_id:      workspaceId,
      customer_id:    customer.id,
      order_status:   "pending",
      payment_status: "unpaid",
      total_amount:   total,
      notes:          draft.notes,
    })
    .select("id")
    .single();

  if (orderErr || !order) return { error: "Failed to create order." };

  // Insert order items
  await admin.from("order_items").insert(
    items.map((item) => ({
      order_id:     order.id,
      product_id:   item.product_id,
      product_name: item.product_name,
      quantity:     item.quantity,
      price:        priceMap[item.product_id] ?? 0,
    }))
  );

  // Mark draft as converted
  await admin
    .from("order_drafts")
    .update({
      status:           "converted",
      reviewed_by:      user.id,
      reviewed_at:      new Date().toISOString(),
      created_order_id: order.id,
    })
    .eq("id", draftId);

  await logActivity({
    workspaceId,
    actorId: user.id,
    entityType: "order_draft",
    entityId: draftId,
    action: "draft_approved",
    meta: { created_order_id: order.id },
  });

  await enqueueJob("automation_event", {
    workspaceId,
    trigger: "order_created",
    entityType: "order",
    entityId: order.id as string,
    meta: {
      source: "whatsapp_ai_approved",
      total_amount: total,
      customer_phone: draft.customer_phone as string,
    },
  });

  revalidatePath("/dashboard/drafts");
  revalidatePath("/dashboard/orders");
  return { orderId: order.id as string };
}

// ─── Reject draft ─────────────────────────────────────────────────────────────

export async function rejectDraft(
  draftId: string,
  reason?: string
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const workspaceId = await resolveWorkspaceId(admin, user.id);
  if (!workspaceId) return { error: "Workspace not found." };
  const access = await assertAiAccess(admin, workspaceId);
  if (!access.ok) return { error: access.error };

  const { data: draft, error: draftError } = await admin
    .from("order_drafts")
    .select("customer_phone, customer_name")
    .eq("id", draftId)
    .eq("workspace_id", workspaceId)
    .eq("status", "pending_review")
    .single();

  if (draftError || !draft) return { error: "Draft not found or already processed." };

  const { error } = await admin
    .from("order_drafts")
    .update({
      status:      "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      notes:       reason ? `Rejected: ${reason}` : null,
    })
    .eq("id", draftId)
    .eq("workspace_id", workspaceId)
    .eq("status", "pending_review");

  if (error) return { error: error.message };

  const { data: workspace } = await admin
    .from("users")
    .select("business_name")
    .eq("id", workspaceId)
    .maybeSingle();

  void notifyDraftRejected({
    customerName: (draft.customer_name as string | null) ?? draft.customer_phone,
    customerPhone: draft.customer_phone as string,
    vendorName: (workspace?.business_name as string | undefined) ?? "our team",
    reason,
  });

  await logActivity({
    workspaceId,
    actorId: user.id,
    entityType: "order_draft",
    entityId: draftId,
    action: "draft_rejected",
    meta: { reason },
  });

  revalidatePath("/dashboard/drafts");
  return {};
}

// ─── Internal helper ──────────────────────────────────────────────────────────

async function resolveWorkspaceId(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<string | null> {
  const { data: owner } = await admin
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (owner) return userId;

  const { data: member } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  return (member?.workspace_id as string) ?? null;
}

async function assertAiAccess(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const currentPlanId = await getWorkspacePlan(admin, workspaceId);
  if (!hasAiInboxCopilotAccess(currentPlanId)) {
    return { ok: false, error: "AI Order Drafts are available on the Pro plan only." };
  }

  return { ok: true };
}
