"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { logActivity } from "@/lib/activity";
import type { WorkspaceRole, WorkspaceMember, WorkspaceInvitation } from "@/types/team";

// ─── Helper: assert caller is owner ─────────────────────────────────────────

async function assertOwner(userId: string): Promise<
  | { ok: true; workspaceId: string }
  | { ok: false; error: string }
> {
  const admin = createAdminClient();

  // The caller is an owner if their auth.uid() === a users.id row (top-level vendor)
  const { data, error } = await admin
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    // Maybe the caller is a staff/delivery_manager trying to perform an owner action
    return { ok: false, error: "Only the workspace owner can perform this action." };
  }

  return { ok: true, workspaceId: data.id };
}

// ─── List team members ───────────────────────────────────────────────────────

export async function listTeamMembers(
  workspaceId: string
): Promise<{ members?: WorkspaceMember[]; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) return { error: error.message };

  // Enrich with emails from auth.users (admin-only API)
  const userIds = (data ?? []).map((m) => m.user_id as string);
  const emailMap: Record<string, string> = {};

  for (const id of userIds) {
    try {
      const { data: authUser } = await admin.auth.admin.getUserById(id);
      if (authUser?.user?.email) emailMap[id] = authUser.user.email;
    } catch (err) {
      // Silently skip if user lookup fails
      console.warn(`Failed to fetch email for user ${id}:`, err);
    }
  }

  const members: WorkspaceMember[] = (data ?? []).map((m) => ({
    id: m.id as string,
    workspace_id: m.workspace_id as string,
    user_id: m.user_id as string,
    role: m.role as WorkspaceRole,
    display_name: m.display_name as string | null,
    is_active: m.is_active as boolean,
    invited_by: m.invited_by as string | null,
    created_at: m.created_at as string,
    updated_at: m.updated_at as string,
    email: emailMap[m.user_id as string],
  }));

  return { members };
}

// ─── List pending invitations ────────────────────────────────────────────────

export async function listInvitations(
  workspaceId: string
): Promise<{ invitations?: WorkspaceInvitation[]; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("workspace_invitations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };

  return { invitations: (data ?? []) as WorkspaceInvitation[] };
}

// ─── Invite a new team member ────────────────────────────────────────────────

export async function inviteTeamMember(
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const ownership = await assertOwner(user.id);
  if (!ownership.ok) return { error: ownership.error };

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const role  = formData.get("role")  as WorkspaceRole;

  if (!email || !role) return { error: "Email and role are required." };
  if (!email.includes("@")) return { error: "Invalid email address." };
  if (!["owner", "staff", "delivery_manager"].includes(role)) {
    return { error: "Invalid role." };
  }

  const admin = createAdminClient();

  // Check for duplicate pending invite
  const { data: existing } = await admin
    .from("workspace_invitations")
    .select("id, status")
    .eq("workspace_id", ownership.workspaceId)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return { error: "There is already a pending invitation for this email." };
  }

  const token     = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  const { error } = await admin
    .from("workspace_invitations")
    .insert({
      workspace_id: ownership.workspaceId,
      email,
      role,
      token,
      expires_at: expiresAt,
      invited_by: user.id,
    });

  if (error) return { error: error.message };

  // Log activity
  await logActivity({
    workspaceId: ownership.workspaceId,
    actorId: user.id,
    entityType: "workspace_invitation",
    action: "invitation_sent",
    meta: { email, role },
  });

  revalidatePath("/dashboard/team");

  // In production, send an email with the acceptance link.
  // The acceptance URL: /team/accept?token=<token>
  // For now we return the token so you can wire email delivery.
  return { ok: true };
}

// ─── Accept an invitation ────────────────────────────────────────────────────

export async function acceptInvitation(
  token: string
): Promise<{ ok?: boolean; workspaceId?: string; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to accept an invitation." };

  const admin = createAdminClient();

  // Fetch the invite
  const { data: invite, error: fetchErr } = await admin
    .from("workspace_invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (fetchErr || !invite) return { error: "Invalid or expired invitation link." };

  if (invite.status !== "pending") {
    return { error: `This invitation has already been ${invite.status}.` };
  }

  if (new Date(invite.expires_at as string) < new Date()) {
    await admin
      .from("workspace_invitations")
      .update({ status: "expired" })
      .eq("id", invite.id);
    return { error: "This invitation has expired." };
  }

  const userEmail = user.email?.toLowerCase();
  const inviteEmail = (invite.email as string).toLowerCase();

  if (userEmail !== inviteEmail) {
    return { error: `This invitation was sent to ${invite.email}. Please sign in with that email.` };
  }

  // Upsert member row
  const { error: memberErr } = await admin
    .from("workspace_members")
    .upsert(
      {
        workspace_id: invite.workspace_id,
        user_id:      user.id,
        role:         invite.role,
        is_active:    true,
        invited_by:   invite.invited_by,
      },
      { onConflict: "workspace_id,user_id" }
    );

  if (memberErr) return { error: memberErr.message };

  // Mark invitation accepted
  await admin
    .from("workspace_invitations")
    .update({ status: "accepted" })
    .eq("id", invite.id);

  await logActivity({
    workspaceId: invite.workspace_id as string,
    actorId: user.id,
    entityType: "workspace_member",
    action: "member_joined",
    meta: { email: user.email, role: invite.role },
  });

  revalidatePath("/dashboard");

  return { ok: true, workspaceId: invite.workspace_id as string };
}

// ─── Revoke an invitation ────────────────────────────────────────────────────

export async function revokeInvitation(
  invitationId: string
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const ownership = await assertOwner(user.id);
  if (!ownership.ok) return { error: ownership.error };

  const admin = createAdminClient();

  const { error } = await admin
    .from("workspace_invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId)
    .eq("workspace_id", ownership.workspaceId);

  if (error) return { error: error.message };

  await logActivity({
    workspaceId: ownership.workspaceId,
    actorId: user.id,
    entityType: "workspace_invitation",
    action: "invitation_revoked",
    meta: { invitation_id: invitationId },
  });

  revalidatePath("/dashboard/team");
  return { ok: true };
}

// ─── Update a member's role ──────────────────────────────────────────────────

export async function updateMemberRole(
  memberId: string,
  newRole: WorkspaceRole
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const ownership = await assertOwner(user.id);
  if (!ownership.ok) return { error: ownership.error };

  if (!["staff", "delivery_manager"].includes(newRole)) {
    return { error: "You can only assign 'staff' or 'delivery_manager' roles." };
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("workspace_members")
    .update({ role: newRole })
    .eq("id", memberId)
    .eq("workspace_id", ownership.workspaceId);

  if (error) return { error: error.message };

  await logActivity({
    workspaceId: ownership.workspaceId,
    actorId: user.id,
    entityType: "workspace_member",
    action: "role_updated",
    meta: { member_id: memberId, new_role: newRole },
  });

  revalidatePath("/dashboard/team");
  return { ok: true };
}

// ─── Remove a member ─────────────────────────────────────────────────────────

export async function removeMember(
  memberId: string
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const ownership = await assertOwner(user.id);
  if (!ownership.ok) return { error: ownership.error };

  const admin = createAdminClient();

  // Prevent owner removing themselves
  const { data: memberRow } = await admin
    .from("workspace_members")
    .select("user_id, role")
    .eq("id", memberId)
    .maybeSingle();

  if (memberRow?.role === "owner") {
    return { error: "Cannot remove the workspace owner." };
  }

  const { error } = await admin
    .from("workspace_members")
    .update({ is_active: false })
    .eq("id", memberId)
    .eq("workspace_id", ownership.workspaceId);

  if (error) return { error: error.message };

  await logActivity({
    workspaceId: ownership.workspaceId,
    actorId: user.id,
    entityType: "workspace_member",
    action: "member_removed",
    meta: { member_id: memberId },
  });

  revalidatePath("/dashboard/team");
  return { ok: true };
}
