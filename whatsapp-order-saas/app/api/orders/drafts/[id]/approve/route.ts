import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerSupabaseClient } from "@/lib/supabaseServer";

/**
 * POST /api/orders/drafts/[id]/approve
 * Convert an order draft to a confirmed order (staff/owner only)
 *
 * Body:
 *   notes?: string - additional notes
 *
 * Steps:
 * 1. Load draft with items
 * 2. Find or create customer by phone
 * 3. Create order + order_items
 * 4. Update draft status to 'converted'
 * 5. Emit order_created automation event
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { notes: approvalNotes } = body;

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // 1. Load the draft
    const { data: draft } = await admin
      .from("order_drafts")
      .select("*")
      .eq("id", id)
      .single();

    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    // Check user is in this workspace
    const { data: member } = await admin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", draft.workspace_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!member && draft.workspace_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // 2. Find or create customer
    let customerId: string;
    const { data: existingCustomer } = await admin
      .from("customers")
      .select("id")
      .eq("vendor_id", draft.workspace_id)
      .eq("phone", draft.customer_phone)
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer, error: custErr } = await admin
        .from("customers")
        .insert({
          vendor_id: draft.workspace_id,
          name: draft.customer_name || "Unknown",
          phone: draft.customer_phone,
        })
        .select("id")
        .single();

      if (custErr || !newCustomer) {
        throw new Error(`Failed to create customer: ${custErr?.message}`);
      }
      customerId = newCustomer.id;
    }

    // 3. Create order
    const items = (draft.items as Array<any>) || [];
    let totalAmount = 0;

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        vendor_id: draft.workspace_id,
        customer_id: customerId,
        order_status: "confirmed",
        payment_status: "unpaid",
        notes: approvalNotes || draft.notes,
        total_amount: 0, // Will be calculated from items
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      throw new Error(`Failed to create order: ${orderErr?.message}`);
    }

    // 4. Create order items and calculate total
    for (const item of items) {
      const { data: product } = await admin
        .from("products")
        .select("id, name, price")
        .eq("id", item.product_id)
        .maybeSingle();

      if (!product) {
        console.warn(`Product ${item.product_id} not found, skipping`);
        continue;
      }

      const quantity = item.quantity || 1;
      const price = product.price || 0;
      const subtotal = quantity * price;
      totalAmount += subtotal;

      await admin
        .from("order_items")
        .insert({
          order_id: order.id,
          product_id: product.id,
          product_name: product.name,
          quantity,
          price,
        });
    }

    // 5. Update order total
    await admin
      .from("orders")
      .update({ total_amount: totalAmount })
      .eq("id", order.id);

    // 6. Update draft status
    await admin
      .from("order_drafts")
      .update({
        status: "converted",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        created_order_id: order.id,
      })
      .eq("id", id);

    // 7. Emit automation event
    const { enqueueJob } = await import("@/lib/jobs");
    await enqueueJob("automation_event", {
      workspaceId: draft.workspace_id,
      trigger: "order_created",
      entityType: "orders",
      entityId: order.id,
      meta: { fromDraft: id, approvedBy: user.id },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      totalAmount,
    });
  } catch (error) {
    console.error("[orders/drafts/[id]/approve] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
