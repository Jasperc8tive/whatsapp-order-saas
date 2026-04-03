import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { enqueueJob } from "@/lib/jobs";

/**
 * POST /api/orders/[id]/assign
 * Assign an order to a staff/delivery manager (owner/staff only)
 *
 * Body:
 *   assignedToUserId: string - user ID to assign to
 *   reason?: string - reason for assignment
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { assignedToUserId, reason } = body;

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // 1. Load order
    const { data: order } = await admin
      .from("orders")
      .select("vendor_id")
      .eq("id", id)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // 2. Check user is in this workspace with appropriate role
    const { data: member } = await admin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", order.vendor_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    const isOwner = order.vendor_id === user.id;
    const isStaffOrOwner =
      isOwner || member?.role === "staff" || member?.role === "owner";

    if (!isStaffOrOwner) {
      return NextResponse.json(
        { error: "Only owner/staff can assign orders" },
        { status: 403 }
      );
    }

    // If unassigning (empty string)
    if (!assignedToUserId) {
      await admin.from("order_assignments").delete().eq("order_id", id);

      // Log activity via job queue (non-blocking, with retry)
      enqueueJob("log_activity", {
        workspaceId: order.vendor_id,
        actorId: user.id,
        entityType: "assignment",
        entityId: id,
        action: "reassigned",
        meta: { action: "unassigned", reason },
      }).catch((err: unknown) => {
        console.error("[orders/assign] Failed to enqueue unassign log:", err);
      });

      return NextResponse.json({
        success: true,
        message: "Order unassigned",
      });
    }

    // 3. Check target user is in workspace
    const { data: targetMember } = await admin
      .from("workspace_members")
      .select("id, role")
      .eq("workspace_id", order.vendor_id)
      .eq("user_id", assignedToUserId)
      .eq("is_active", true)
      .maybeSingle();

    if (!targetMember) {
      return NextResponse.json(
        { error: "Target user is not a member of this workspace" },
        { status: 400 }
      );
    }

    // 4. Upsert assignment (unique constraint on order_id)
    const { error: assignErr } = await admin
      .from("order_assignments")
      .upsert(
        {
          order_id: id,
          assigned_to: assignedToUserId,
          assigned_by: user.id,
          reason: reason || "Assigned via queue board",
        },
        { onConflict: "order_id" }
      );

    if (assignErr) {
      throw assignErr;
    }

    // Get delivery manager details
    let managerName = "Team Member";
    try {
      const { data: managerData } = await admin.auth.admin.getUserById(
        assignedToUserId
      );
      if (managerData?.user) {
        const userMeta = managerData.user.user_metadata as Record<string, any> || {};
        managerName =
          userMeta.display_name ||
          userMeta.name ||
          managerData.user.email ||
          "Team Member";
      }
    } catch {
      // Keep default name
    }

    // 5. Log activity via job queue (non-blocking, with retry)
    enqueueJob("log_activity", {
      workspaceId: order.vendor_id,
      actorId: user.id,
      entityType: "assignment",
      entityId: id,
      action: "assigned",
      meta: { assigned_to: assignedToUserId, assigned_to_name: managerName, reason },
    }).catch((err: unknown) => {
      console.error("[orders/assign] Failed to enqueue assign log:", err);
    });

    return NextResponse.json({
      success: true,
      message: "Order assigned",
    });
  } catch (error) {
    console.error("[orders/[id]/assign] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
