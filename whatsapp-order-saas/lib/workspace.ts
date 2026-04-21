/**
 * Workspace and role resolution helpers.
 * 
 * Coordinates between owner (users table) and team member (workspace_members table) models.
 */

import { createAdminClient } from "./supabaseAdmin";
import { createServerSupabaseClient } from "./supabaseServer";
import type { WorkspaceRole } from "@/types/team";

/**
 * Resolve the workspace ID for the current user.
 * - If the user is an owner (exists in users table), returns their own ID.
 * - If the user is a team member, returns their workspace_id.
 */
export async function getCurrentWorkspaceId(userId: string): Promise<string | null> {
  const admin = createAdminClient();

  // Check if user is an owner (has a row in users table)
  const { data: ownerRow } = await admin
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (ownerRow) {
    return userId;
  }

  // Check if user is a team member
  const { data: memberRow } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  return memberRow?.workspace_id ?? null;
}

/**
 * Get the workspace role for the current user.
 * - Owners always have role 'owner'.
 * - Team members get their role from workspace_members.
 */
export async function getCurrentWorkspaceRole(
  userId: string
): Promise<WorkspaceRole | null> {
  const admin = createAdminClient();

  // Check if user is an owner
  const { data: ownerRow } = await admin
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (ownerRow) {
    return "owner";
  }

  // Get team member role
  const { data: memberRow } = await admin
    .from("workspace_members")
    .select("role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  return (memberRow?.role as WorkspaceRole) ?? null;
}

/**
 * Assert that the current user has a given role or higher.
 * Hieararchy: owner > staff > delivery_manager
 * 
 * @returns object with ok: true and workspaceId if authorized, otherwise error message
 */
export async function assertWorkspaceRole(
  userId: string,
  requiredRole: WorkspaceRole
): Promise<
  | { ok: true; workspaceId: string; role: WorkspaceRole }
  | { ok: false; error: string }
> {
  const workspaceId = await getCurrentWorkspaceId(userId);
  if (!workspaceId) {
    return { ok: false, error: "Workspace not found. Please ensure you're logged in." };
  }

  const role = await getCurrentWorkspaceRole(userId);
  if (!role) {
    return { ok: false, error: "No role assigned. Contact your workspace owner." };
  }

  // Role hierarchy: owner > staff > delivery_manager
  const roleHierarchy: Record<WorkspaceRole, number> = {
    owner: 3,
    staff: 2,
    delivery_manager: 1,
  };

  const currentLevel = roleHierarchy[role];
  const requiredLevel = roleHierarchy[requiredRole];

  if (currentLevel < requiredLevel) {
    return {
      ok: false,
      error: `This action requires ${requiredRole} role or higher. You have ${role} role.`,
    };
  }

  return { ok: true, workspaceId, role };
}

/**
 * Check if a user has permission to write to orders/customers/products.
 * Staff and owners can write; delivery_manager can only update existing records (not create).
 */
export async function canWriteOrder(userId: string): Promise<boolean> {
  const role = await getCurrentWorkspaceRole(userId);
  return role === "owner" || role === "staff";
}

/**
 * Check if a user has permission to update order status/delivery info.
 * All roles (owner, staff, delivery_manager) can update delivery-related fields.
 */
export async function canUpdateOrderDelivery(userId: string): Promise<boolean> {
  const workspaceId = await getCurrentWorkspaceId(userId);
  return !!workspaceId; // Any active team member can update delivery fields
}
