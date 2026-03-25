import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerSupabaseClient } from "@/lib/supabaseServer";

/**
 * POST /api/team/invitations/[id]/accept
 * Accept a pending invitation and add user to workspace.
 *
 * Note: [id] in this route is the invitation token so that all sibling
 * dynamic segments under /api/team/invitations share the same slug name.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const token = id;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // 1. Find the invitation by token
    const { data: invitation } = await admin
      .from("workspace_invitations")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    // 2. Validate invitation status and expiry
    if (invitation.status !== "pending") {
      return NextResponse.json(
        { error: `Invitation is ${invitation.status}` },
        { status: 400 }
      );
    }

    const expiresAt = new Date(invitation.expires_at);
    if (new Date() > expiresAt) {
      await admin
        .from("workspace_invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);

      return NextResponse.json({ error: "Invitation has expired" }, { status: 400 });
    }

    // 3. Verify the email matches the logged-in user
    if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        { error: "Email mismatch. Log in with the invited email address." },
        { status: 403 }
      );
    }

    // 4. Check user is not already a member
    const { data: existingMember } = await admin
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", invitation.workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingMember) {
      return NextResponse.json(
        { error: "You are already a member of this workspace" },
        { status: 409 }
      );
    }

    // 5. Create membership entry
    const { error: memberErr } = await admin.from("workspace_members").insert({
      workspace_id: invitation.workspace_id,
      user_id: user.id,
      role: invitation.role,
      display_name: user.email?.split("@")[0] || "Team Member",
      is_active: true,
      invited_by: invitation.invited_by,
    });

    if (memberErr) {
      console.error("[team/invitations/accept]", memberErr);
      return NextResponse.json(
        { error: "Failed to accept invitation" },
        { status: 500 }
      );
    }

    // 6. Mark invitation as accepted
    await admin
      .from("workspace_invitations")
      .update({ status: "accepted" })
      .eq("id", invitation.id);

    return NextResponse.json({
      success: true,
      message: "Invitation accepted!",
      workspaceId: invitation.workspace_id,
      role: invitation.role,
    });
  } catch (error) {
    console.error("[team/invitations/accept] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
