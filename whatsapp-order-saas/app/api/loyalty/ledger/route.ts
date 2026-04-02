import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentWorkspaceId } from "@/lib/workspace";

type LoyaltyAction = "bonus" | "redeem";

interface LoyaltyBody {
  customerId: string;
  action: LoyaltyAction;
  points: number;
  reason?: string;
}

function parseLimit(raw: string | null): number {
  const value = Number(raw ?? 20);
  if (!Number.isFinite(value)) return 20;
  return Math.min(100, Math.max(1, Math.floor(value)));
}

async function authenticate(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const token = authHeader.slice("Bearer ".length);
  const admin = createAdminClient();
  const { data: authResult, error: authError } = await admin.auth.getUser(token);

  if (authError || !authResult.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const workspaceId = await getCurrentWorkspaceId(authResult.user.id);
  if (!workspaceId) {
    return { error: NextResponse.json({ error: "Workspace not found" }, { status: 404 }) };
  }

  return { admin, userId: authResult.user.id, workspaceId };
}

async function getBalance(admin: ReturnType<typeof createAdminClient>, workspaceId: string, customerId: string) {
  const { data, error } = await admin
    .from("loyalty_transactions")
    .select("points")
    .eq("vendor_id", workspaceId)
    .eq("customer_id", customerId);

  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + Number(row.points ?? 0), 0);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const customerId = request.nextUrl.searchParams.get("customerId");
    if (!customerId) {
      return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

    const { data: customerRow, error: customerError } = await auth.admin
      .from("customers")
      .select("id")
      .eq("id", customerId)
      .eq("vendor_id", auth.workspaceId)
      .maybeSingle();

    if (customerError) {
      return NextResponse.json({ error: customerError.message }, { status: 500 });
    }

    if (!customerRow) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const { data: ledger, error: ledgerError } = await auth.admin
      .from("loyalty_transactions")
      .select("id,points,reason,created_by,created_at")
      .eq("vendor_id", auth.workspaceId)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (ledgerError) {
      return NextResponse.json({ error: ledgerError.message }, { status: 500 });
    }

    const balance = await getBalance(auth.admin, auth.workspaceId, customerId);

    return NextResponse.json({
      customerId,
      balance,
      transactions: ledger ?? [],
    });
  } catch (error) {
    console.error("[loyalty/ledger:get]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as LoyaltyBody;
    const customerId = body.customerId?.trim();
    const action: LoyaltyAction = body.action === "redeem" ? "redeem" : "bonus";
    const points = Math.floor(Number(body.points ?? 0));

    if (!customerId) {
      return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    if (!Number.isFinite(points) || points <= 0) {
      return NextResponse.json({ error: "points must be a positive integer" }, { status: 400 });
    }

    const { data: customerRow, error: customerError } = await auth.admin
      .from("customers")
      .select("id")
      .eq("id", customerId)
      .eq("vendor_id", auth.workspaceId)
      .maybeSingle();

    if (customerError) {
      return NextResponse.json({ error: customerError.message }, { status: 500 });
    }

    if (!customerRow) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const currentBalance = await getBalance(auth.admin, auth.workspaceId, customerId);
    const signedPoints = action === "redeem" ? -points : points;

    if (action === "redeem" && currentBalance < points) {
      return NextResponse.json({ error: "Insufficient loyalty points for redemption" }, { status: 400 });
    }

    const { data: inserted, error: insertError } = await auth.admin
      .from("loyalty_transactions")
      .insert({
        vendor_id: auth.workspaceId,
        customer_id: customerId,
        points: signedPoints,
        reason: body.reason?.trim() || (action === "redeem" ? "Reward redemption" : "Manual bonus"),
        created_by: auth.userId,
      })
      .select("id,points,reason,created_by,created_at")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      customerId,
      action,
      transaction: inserted,
      balance: currentBalance + signedPoints,
    });
  } catch (error) {
    console.error("[loyalty/ledger:post]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
