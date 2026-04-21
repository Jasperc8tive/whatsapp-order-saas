import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerSupabaseClient } from "@/lib/supabaseServer";

/**
 * DELETE /api/team/invitations/[id]
 * Revoke a pending invitation (owner only)
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
        { error: "Only workspace owners can revoke invitations" },
        { status: 403 }
      );
    }

    // Set invitation status to revoked
    const { error } = await admin
      .from("workspace_invitations")
      .update({ status: "revoked" })
      .eq("id", id)
      .eq("workspace_id", user.id);

    if (error) {
      console.error("[team/invitations/[id]] DELETE error:", error);
      return NextResponse.json({ error: "Failed to revoke invitation" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[team/invitations/[id]] DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
