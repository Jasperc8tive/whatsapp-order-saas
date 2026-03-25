import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerSupabaseClient } from "@/lib/supabaseServer";

/**
 * PATCH /api/team/members/[id]/role
 * Update a team member's role (owner only)
 *
 * Body: { role: 'staff' | 'delivery_manager' }
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { role } = body;

    if (!role || !["staff", "delivery_manager"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be 'staff' or 'delivery_manager'" },
        { status: 400 }
      );
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
        { error: "Only workspace owners can update member roles" },
        { status: 403 }
      );
    }

    // Update member role
    const { error } = await admin
      .from("workspace_members")
      .update({ role })
      .eq("id", id)
      .eq("workspace_id", user.id);

    if (error) {
      console.error("[team/members/[id]/role] PATCH error:", error);
      return NextResponse.json({ error: "Failed to update member role" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[team/members/[id]/role] PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/team/members/[id]
 * Remove a team member from the workspace (owner only)
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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
        { error: "Only workspace owners can remove members" },
        { status: 403 }
      );
    }

    // Soft-delete: set is_active = false
    const { error } = await admin
      .from("workspace_members")
      .update({ is_active: false })
      .eq("id", id)
      .eq("workspace_id", user.id);

    if (error) {
      console.error("[team/members/[id]] DELETE error:", error);
      return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[team/members/[id]] DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
