import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentWorkspaceId } from "@/lib/workspace";

const DEFAULT_POINTS_PER_ORDER = 10;
const DEFAULT_REWARD_THRESHOLD = 100;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.slice("Bearer ".length);
    const admin = createAdminClient();
    const { data: authResult, error: authError } = await admin.auth.getUser(token);

    if (authError || !authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = await getCurrentWorkspaceId(authResult.user.id);
    if (!workspaceId) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const [configRes, statsRes, ledgerRes] = await Promise.all([
      admin
        .from("users")
        .select("loyalty_points_per_order,loyalty_reward_threshold")
        .eq("id", workspaceId)
        .single(),
      admin
        .from("customer_stats")
        .select("id,name,phone,total_orders,total_spent")
        .eq("vendor_id", workspaceId)
        .order("total_orders", { ascending: false })
        .limit(100),
      admin
        .from("loyalty_transactions")
        .select("customer_id,points")
        .eq("vendor_id", workspaceId),
    ]);

    if (configRes.error) {
      return NextResponse.json({ error: configRes.error.message }, { status: 500 });
    }

    if (statsRes.error) {
      return NextResponse.json({ error: statsRes.error.message }, { status: 500 });
    }

    if (ledgerRes.error) {
      return NextResponse.json({ error: ledgerRes.error.message }, { status: 500 });
    }

    const pointsPerOrder = Number(configRes.data?.loyalty_points_per_order ?? DEFAULT_POINTS_PER_ORDER);
    const rewardThreshold = Number(configRes.data?.loyalty_reward_threshold ?? DEFAULT_REWARD_THRESHOLD);

    const ledgerByCustomer = new Map<string, number>();
    for (const row of ledgerRes.data ?? []) {
      const customerId = row.customer_id as string;
      const points = Number(row.points ?? 0);
      ledgerByCustomer.set(customerId, (ledgerByCustomer.get(customerId) ?? 0) + points);
    }

    const members = (statsRes.data ?? []).map((row) => {
      const customerId = row.id as string;
      const totalOrders = Number(row.total_orders ?? 0);
      const basePoints = totalOrders * pointsPerOrder;
      const manualPoints = ledgerByCustomer.get(customerId) ?? 0;
      const points = basePoints + manualPoints;

      return {
        id: customerId,
        name: (row.name as string) ?? "Unknown",
        phone: (row.phone as string) ?? "",
        total_orders: totalOrders,
        total_spent: Number(row.total_spent ?? 0),
        points,
        rewardUnits: Math.floor(points / rewardThreshold),
      };
    });

    return NextResponse.json({
      pointsPerOrder,
      rewardThreshold,
      members,
    });
  } catch (error) {
    console.error("[loyalty/overview]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
