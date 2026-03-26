import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import crypto from "crypto";

/**
 * POST /api/team/invitations
 * Create and send a team invitation
 *
 * Body:
 *   email: string - email to invite
 *   role: 'staff' | 'delivery_manager' - role for the invite
 *   message?: string - optional custom message
 *
 * Owner only
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse body
    const body = await request.json();
    const { email, role } = body;

    if (!email || !role) {
      return NextResponse.json(
        { error: "Missing required fields: email, role" },
        { status: 400 }
      );
    }

    if (!["staff", "delivery_manager"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be 'staff' or 'delivery_manager'" },
        { status: 400 }
      );
    }

    // 3. Check that user is workspace owner
    const admin = createAdminClient();
    const { data: owner } = await admin
      .from("users")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!owner) {
      return NextResponse.json(
        { error: "Only workspace owners can create invitations" },
        { status: 403 }
      );
    }

    // 4. Check invitation doesn't already exist
    const { data: existing } = await admin
      .from("workspace_invitations")
      .select("id")
      .eq("workspace_id", user.id)
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Pending invitation already exists for this email" },
        { status: 409 }
      );
    }

    // 5. Check user isn't already a member
    const { data: authUserByEmail } = await admin.auth.admin.listUsers();
    const targetAuthUser = authUserByEmail.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (targetAuthUser) {
      const { data: member } = await admin
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", user.id)
        .eq("user_id", targetAuthUser.id)
        .eq("is_active", true)
        .maybeSingle();

      if (member) {
        return NextResponse.json(
          { error: "User is already a member of this workspace" },
          { status: 409 }
        );
      }
    }

    // 6. Generate invite token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // 7. Create invitation
    const { data: invitation, error: inviteErr } = await admin
      .from("workspace_invitations")
      .insert({
        workspace_id: user.id,
        email: email.toLowerCase(),
        role,
        token,
        status: "pending",
        expires_at: expiresAt.toISOString(),
        invited_by: user.id,
      })
      .select()
      .single();

    if (inviteErr) {
      console.error("[team/invitations]", inviteErr);
      return NextResponse.json(
        { error: "Failed to create invitation" },
        { status: 500 }
      );
    }

    // 8. TODO: Send email with invitation link
    // For now, just return the token so caller can share it
    const acceptLink = `${process.env.SITE_URL}/dashboard/team/accept?token=${token}`;

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expires_at,
        acceptLink, // In prod, this should be in email only
      },
    });
  } catch (error) {
    console.error("[team/invitations] POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/team/invitations
 * List invitations for this workspace (owner only)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check owner
    const admin = createAdminClient();
    const { data: owner } = await admin
      .from("users")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!owner) {
      return NextResponse.json(
        { error: "Only workspace owners can view invitations" },
        { status: 403 }
      );
    }

    const { data: invitations } = await admin
      .from("workspace_invitations")
      .select("*")
      .eq("workspace_id", user.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ invitations: invitations ?? [] });
  } catch (error) {
    console.error("[team/invitations] GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
