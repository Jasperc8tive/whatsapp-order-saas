"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { logActivity } from "@/lib/activity";
import type { OrderAssignment } from "@/types/team";

// ─── Assign an order to a team member ───────────────────────────────────────

export async function assignOrder(
  orderId: string,
  assignedToUserId: string,
  reason?: string
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  // Resolve workspace for this order
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("vendor_id")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !order) return { error: "Order not found." };

  const workspaceId = order.vendor_id as string;

  // Verify caller is a member of this workspace (owner or staff)
  const { data: callerMembership } = await admin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const callerIsOwner = user.id === workspaceId;
  const callerRole = callerMembership?.role as string | undefined;

  if (!callerIsOwner && callerRole !== "staff" && callerRole !== "delivery_manager") {
    return { error: "You do not have permission to assign orders." };
  }

  // Delivery managers can only assign to themselves or other delivery managers
  if (callerRole === "delivery_manager" && assignedToUserId !== user.id) {
    const { data: targetMembership } = await admin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", assignedToUserId)
      .eq("is_active", true)
      .maybeSingle();

    if (targetMembership?.role !== "delivery_manager") {
      return { error: "Delivery managers can only assign orders to other delivery managers." };
    }
  }

  // Upsert assignment (one active assignment per order)
  const { error: upsertErr } = await admin
    .from("order_assignments")
    .upsert(
      {
        order_id:    orderId,
        assigned_to: assignedToUserId,
        assigned_by: user.id,
        reason:      reason ?? null,
      },
      { onConflict: "order_id" }
    );

  if (upsertErr) return { error: upsertErr.message };

  await logActivity({
    workspaceId,
    actorId: user.id,
    entityType: "order",
    entityId: orderId,
    action: "order_assigned",
    meta: { assigned_to: assignedToUserId, reason },
  });

  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/orders");

  return { ok: true };
}

// ─── Get assignment for an order ─────────────────────────────────────────────

export async function getOrderAssignment(
  orderId: string
): Promise<{ assignment?: OrderAssignment | null; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("order_assignments")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { assignment: null };

  // Enrich with assignee info
  const { data: assigneeAuth } = await admin.auth.admin.getUserById(
    data.assigned_to as string
  );

  const assigneeEmail = assigneeAuth?.user?.email ?? null;
  const { data: memberRow } = await admin
    .from("workspace_members")
    .select("display_name")
    .eq("user_id", data.assigned_to)
    .maybeSingle();

  const assignment: OrderAssignment = {
    id:             data.id as string,
    order_id:       data.order_id as string,
    assigned_to:    data.assigned_to as string,
    assigned_by:    data.assigned_by as string,
    reason:         data.reason as string | null,
    created_at:     data.created_at as string,
    assignee_name:  (memberRow?.display_name as string | null) ?? null,
    assignee_email: assigneeEmail,
  };

  return { assignment };
}

// ─── Unassign an order ────────────────────────────────────────────────────────

export async function unassignOrder(
  orderId: string
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("vendor_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return { error: "Order not found." };

  const { error } = await admin
    .from("order_assignments")
    .delete()
    .eq("order_id", orderId);

  if (error) return { error: error.message };

  await logActivity({
    workspaceId: order.vendor_id as string,
    actorId: user.id,
    entityType: "order",
    entityId: orderId,
    action: "order_unassigned",
    meta: {},
  });

  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/orders");

  return { ok: true };
}

// ─── List all members in a workspace (for assignment dropdowns) ──────────────

export async function listAssignableMembers(
  workspaceId: string
): Promise<{ members?: Array<{ user_id: string; display_name: string | null; email: string; role: string }>; error?: string }> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("workspace_members")
    .select("user_id, display_name, role")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .order("role", { ascending: true });

  if (error) return { error: error.message };

  const enriched = await Promise.all(
    (data ?? []).map(async (m) => {
      const { data: au } = await admin.auth.admin.getUserById(m.user_id as string);
      return {
        user_id:      m.user_id as string,
        display_name: m.display_name as string | null,
        email:        au?.user?.email ?? "",
        role:         m.role as string,
      };
    })
  );

  // Include the owner (they are not in workspace_members as a row by default)
  const { data: ownerRow } = await admin
    .from("users")
    .select("id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (ownerRow) {
    const alreadyIncluded = enriched.some((m) => m.user_id === workspaceId);
    if (!alreadyIncluded) {
      const { data: ownerAuth } = await admin.auth.admin.getUserById(workspaceId);
      enriched.unshift({
        user_id:      workspaceId,
        display_name: null,
        email:        ownerAuth?.user?.email ?? "",
        role:         "owner",
      });
    }
  }

  return { members: enriched };
}
