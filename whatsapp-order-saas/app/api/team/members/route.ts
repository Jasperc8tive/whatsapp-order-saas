import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerSupabaseClient } from "@/lib/supabaseServer";

/**
 * GET /api/team/members
 * List all active members of the current workspace
 *
 * Returns workspace_members with user email (joined from auth.users)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Get workspace ID for the user
    const workspaceId = user.id;

    // Fetch members with user details
    const { data: members } = await admin
      .from("workspace_members")
      .select("id, user_id, role, display_name, is_active, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (!members) {
      return NextResponse.json({ members: [] });
    }

    // Fetch user emails for all members
    const userIds = members.map((m) => m.user_id);
    const { data: { users: authUsers } } = await admin.auth.admin.listUsers();

    const userEmailMap: Record<string, string> = {};
    (authUsers || []).forEach((u) => {
      userEmailMap[u.id] = u.email || "";
    });

    // Enhance members with email
    const enriched = members.map((m) => ({
      ...m,
      email: userEmailMap[m.user_id],
      isOwner: false, // Current user owns workspace if their id = workspace_id
    }));

    return NextResponse.json({ members: enriched });
  } catch (error) {
    console.error("[team/members] GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
