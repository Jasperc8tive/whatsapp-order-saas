import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

/**
 * GET /api/activity
 * Fetch activity log with optional filters
 *
 * Query params:
 *   vendorId: string - vendor/workspace ID
 *   entityType?: string
 *   action?: string - action type
 *   dateRange?: 'today' | 'week' | 'month' | 'all'
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get("vendorId");
    const entityType = searchParams.get("entityType");
    const action = searchParams.get("action");
    const dateRange = searchParams.get("dateRange") || "all";

    if (!vendorId) {
      return NextResponse.json({ error: "Missing vendorId" }, { status: 400 });
    }

    // Check user access to this vendor
    const { data: member } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", vendorId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!member && user.id !== vendorId) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const admin = createAdminClient();

    // Build query
    let query = admin
      .from("activity_logs")
      .select("*")
      .eq("workspace_id", vendorId)
      .order("created_at", { ascending: false })
      .limit(100);

    // Filter by entity type
    if (entityType) {
      query = query.eq("entity_type", entityType);
    }

    // Filter by action
    if (action) {
      query = query.eq("action", action);
    }

    // Filter by date range
    const now = new Date();
    let startDate: Date | null = null;

    switch (dateRange) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "all":
      default:
        break;
    }

    if (startDate) {
      query = query.gte("created_at", startDate.toISOString());
    }

    const { data: activities, error } = await query;

    if (error) {
      console.error("Activity fetch error:", error);
      throw error;
    }

    // Enrich with user names
    const enrichedActivities = await Promise.all(
      (activities || []).map(async (activity: any) => {
        let actor_name = "System";

        if (activity.actor_id) {
          try {
            const { data: managerData } = await admin.auth.admin.getUserById(
              activity.actor_id
            );
            if (managerData?.user) {
              const userMeta = managerData.user.user_metadata as Record<string, any> || {};
              actor_name =
                userMeta.display_name ||
                userMeta.name ||
                managerData.user.email ||
                "Unknown";
            }
          } catch {
            // Fallback to unknown
          }
        }

        return {
          ...activity,
          actor_name,
          // Format for component compatibility
          created_by_id: activity.actor_id,
          created_by_name: actor_name,
          metadata: activity.meta || {},
          description: activity.action,
        };
      })
    );

    return NextResponse.json(
      {
        success: true,
        activities: enrichedActivities,
        total: enrichedActivities.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[/api/activity] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch activities" },
      { status: 500 }
    );
  }
}

