import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerSupabaseClient } from "@/lib/supabaseServer";

/**
 * POST /api/orders/drafts/[id]/reject
 * Reject an order draft (staff/owner only)
 *
 * Body:
 *   reason: string - reason for rejection
 *
 * Steps:
 * 1. Load draft
 * 2. Validate user is in workspace
 * 3. Update draft status to 'rejected'
 * 4. Optionally send rejection message to customer
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { reason } = body;

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // 1. Load draft
    const { data: draft } = await admin
      .from("order_drafts")
      .select("*")
      .eq("id", id)
      .single();

    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    // 2. Check authorization
    const { data: member } = await admin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", draft.workspace_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!member && draft.workspace_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // 3. Update draft
    const { error } = await admin
      .from("order_drafts")
      .update({
        status: "rejected",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      throw error;
    }

    // 4. TODO: Send rejection message to customer
    // For now, just mark as rejected in the system

    return NextResponse.json({
      success: true,
      message: "Draft rejected",
    });
  } catch (error) {
    console.error("[orders/drafts/[id]/reject] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
