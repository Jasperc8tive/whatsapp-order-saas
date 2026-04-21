"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { logActivity } from "@/lib/activity";
import { enqueueNotificationJob } from "@/lib/notificationQueue";
import type { OrderAssignment } from "@/types/team";
import type { WorkspaceRole } from "@/types/team";

type AssignmentActor = {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
};

function parseWorkspaceRole(role: unknown): WorkspaceRole | null {
  if (role === "owner" || role === "staff" || role === "delivery_manager") {
    return role;
  }
  return null;
}

async function resolveOrderActor(
  orderId: string
): Promise<{ actor?: AssignmentActor; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("vendor_id")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !order) return { error: "Order not found." };

  const workspaceId = order.vendor_id as string;
  const isOwner = user.id === workspaceId;

  if (isOwner) {
    return {
      actor: {
        userId: user.id,
        workspaceId,
        role: "owner",
      },
    };
  }

  const { data: member, error: memberErr } = await admin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (memberErr || !member) return { error: "You do not have access to this order." };

  const role = parseWorkspaceRole(member.role);
  if (!role) return { error: "Invalid workspace role configuration." };

  return {
    actor: {
      userId: user.id,
      workspaceId,
      role,
    },
  };
}

async function resolveWorkspaceActor(
  workspaceId: string
): Promise<{ actor?: AssignmentActor; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  if (user.id === workspaceId) {
    return {
      actor: {
        userId: user.id,
        workspaceId,
        role: "owner",
      },
    };
  }

  const admin = createAdminClient();
  const { data: member, error } = await admin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !member) return { error: "You do not have access to this workspace." };

  const role = parseWorkspaceRole(member.role);
  if (!role) return { error: "Invalid workspace role configuration." };

  return {
    actor: {
      userId: user.id,
      workspaceId,
      role,
    },
  };
}

// ─── Assign an order to a team member ───────────────────────────────────────

export async function assignOrder(
  orderId: string,
  assignedToUserId: string,
  reason?: string
): Promise<{ ok?: boolean; error?: string }> {
  if (!orderId || !assignedToUserId) {
    return { error: "Order and assignee are required." };
  }

  const actorResult = await resolveOrderActor(orderId);
  if (!actorResult.actor) return { error: actorResult.error ?? "Access denied." };

  const actor = actorResult.actor;
  const admin = createAdminClient();

  if (actor.role !== "owner" && actor.role !== "staff" && actor.role !== "delivery_manager") {
    return { error: "You do not have permission to assign orders." };
  }

  const { data: targetMembership } = await admin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", actor.workspaceId)
    .eq("user_id", assignedToUserId)
    .eq("is_active", true)
    .maybeSingle();

  const targetIsOwner = assignedToUserId === actor.workspaceId;
  const targetRole = targetIsOwner
    ? "owner"
    : parseWorkspaceRole(targetMembership?.role);

  if (!targetRole) {
    return { error: "Selected assignee is not an active member of this workspace." };
  }

  // Delivery managers can only assign to themselves or other delivery managers
  if (actor.role === "delivery_manager" && assignedToUserId !== actor.userId) {
    if (targetRole !== "delivery_manager") {
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
        assigned_by: actor.userId,
        reason:      reason?.trim() ? reason.trim() : null,
      },
      { onConflict: "order_id" }
    );

  if (upsertErr) return { error: upsertErr.message };

  await logActivity({
    workspaceId: actor.workspaceId,
    actorId: actor.userId,
    entityType: "order",
    entityId: orderId,
    action: "order_assigned",
    meta: { assigned_to: assignedToUserId, reason },
  });

  // ── Manager assignment notification ──
  // Fetch assignee phone/email for notification
  const { data: assignee } = await admin
    .from("users")
    .select("phone, email, display_name")
    .eq("id", assignedToUserId)
    .maybeSingle();
  if (assignee?.phone) {
    await enqueueNotificationJob({
      type: "manager_assignment",
      recipient: assignee.phone,
      channel: "whatsapp",
      template: `You have been assigned a new order (${orderId.slice(0,8).toUpperCase()}). Please check your dashboard.`,
      data: { orderId, assignedBy: actor.userId, reason },
    });
  }

  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/orders");

  return { ok: true };
}

// ─── Get assignment for an order ─────────────────────────────────────────────

export async function getOrderAssignment(
  orderId: string
): Promise<{ assignment?: OrderAssignment | null; error?: string }> {
  const actorResult = await resolveOrderActor(orderId);
  if (!actorResult.actor) return { error: actorResult.error ?? "Access denied." };

  const actor = actorResult.actor;

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("order_assignments")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { assignment: null };

  const assignedTo = data.assigned_to as string;
  const assignedToIsOwner = assignedTo === actor.workspaceId;

  const { data: memberRow } = await admin
    .from("workspace_members")
    .select("display_name")
    .eq("workspace_id", actor.workspaceId)
    .eq("user_id", assignedTo)
    .maybeSingle();

  if (!assignedToIsOwner && !memberRow) {
    return { error: "Assignment assignee is not an active workspace member." };
  }

  // Enrich with assignee info
  const { data: assigneeAuth } = await admin.auth.admin.getUserById(
    assignedTo
  );

  const assigneeEmail = assigneeAuth?.user?.email ?? null;

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
  if (!orderId) return { error: "Order is required." };

  const actorResult = await resolveOrderActor(orderId);
  if (!actorResult.actor) return { error: actorResult.error ?? "Access denied." };

  const actor = actorResult.actor;

  const admin = createAdminClient();

  if (actor.role !== "owner" && actor.role !== "staff" && actor.role !== "delivery_manager") {
    return { error: "You do not have permission to unassign orders." };
  }

  if (actor.role === "delivery_manager") {
    const { data: currentAssignment } = await admin
      .from("order_assignments")
      .select("assigned_to")
      .eq("order_id", orderId)
      .maybeSingle();

    if (!currentAssignment) {
      return { error: "Order is not currently assigned." };
    }

    if (currentAssignment?.assigned_to !== actor.userId) {
      return { error: "Delivery managers can only unassign orders assigned to themselves." };
    }
  }

  const { error } = await admin
    .from("order_assignments")
    .delete()
    .eq("order_id", orderId);

  if (error) return { error: error.message };

  await logActivity({
    workspaceId: actor.workspaceId,
    actorId: actor.userId,
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
  const actorResult = await resolveWorkspaceActor(workspaceId);
  if (!actorResult.actor) return { error: actorResult.error ?? "Access denied." };

  const actor = actorResult.actor;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("workspace_members")
    .select("user_id, display_name, role")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .order("role", { ascending: true });

  if (error) return { error: error.message };

  let permitted = data ?? [];
  if (actor.role === "delivery_manager") {
    permitted = permitted.filter((m) => m.user_id === actor.userId || m.role === "delivery_manager");
  }

  const enriched = await Promise.all(
    permitted.map(async (m) => {
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

  if (ownerRow && actor.role !== "delivery_manager") {
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
