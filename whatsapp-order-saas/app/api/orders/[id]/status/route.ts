import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerSupabaseClient } from "@/lib/supabaseServer";

/**
 * PATCH /api/orders/[id]/status
 * Update order status (owner/staff/delivery_manager with assignment)
 *
 * Body:
 *   orderStatus?: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
 *   paymentStatus?: 'unpaid' | 'pending' | 'paid' | 'refunded' | 'failed'
 *   notes?: string
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { orderStatus, paymentStatus, notes } = body;

    if (!orderStatus && !paymentStatus) {
      return NextResponse.json(
        { error: "Must provide at least one of: orderStatus, paymentStatus" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // 1. Load order
    const { data: order } = await admin
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // 2. Check authorization
    const isOwner = order.vendor_id === user.id;
    
    const { data: member } = await admin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", order.vendor_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    const role = isOwner ? "owner" : member?.role;

    if (!isOwner && !member) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delivery managers can only update if assigned to them
    if (role === "delivery_manager") {
      const { data: assignment } = await admin
        .from("order_assignments")
        .select("id")
        .eq("order_id", id)
        .eq("assigned_to", user.id)
        .maybeSingle();

      if (!assignment) {
        return NextResponse.json(
          { error: "Delivery managers can only update assigned orders" },
          { status: 403 }
        );
      }
    }

    // 3. Update order
    const updates: Record<string, any> = {};
    if (orderStatus) updates.order_status = orderStatus;
    if (paymentStatus) updates.payment_status = paymentStatus;
    if (notes) updates.notes = notes;
    updates.updated_at = new Date().toISOString();

    const { error: updateErr } = await admin
      .from("orders")
      .update(updates)
      .eq("id", id);

    if (updateErr) {
      throw updateErr;
    }

    // 4. Log activity
    const { enqueueJob } = await import("@/lib/jobs");
    await enqueueJob("log_activity", {
      workspaceId: order.vendor_id,
      actorId: user.id,
      entityType: "orders",
      entityId: id,
      action: "status_updated",
      meta: { orderStatus, paymentStatus, role },
    }).catch(() => {
      // Non-critical; continue even if logging fails
    });

    // 5. Emit automation event if status changed
    if (orderStatus) {
      await enqueueJob("automation_event", {
        workspaceId: order.vendor_id,
        trigger: "order_status_changed",
        entityType: "orders",
        entityId: id,
        meta: { newStatus: orderStatus, oldStatus: order.order_status },
      }).catch(() => {
        // Non-critical
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[orders/[id]/status] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
