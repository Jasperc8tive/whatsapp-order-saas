import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { sendTextMessage } from "@/lib/whatsapp";

type CampaignSegment = "all_customers" | "repeat_buyers";

interface CampaignBody {
  message: string;
  segment: CampaignSegment;
}

function parseLimit(raw: string | null): number {
  const value = Number(raw ?? 20);
  if (!Number.isFinite(value)) return 20;
  return Math.min(100, Math.max(1, Math.floor(value)));
}

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

    const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
    const { data, error } = await admin
      .from("campaign_history")
      .select("id,segment,message,recipient_count,sent_count,failed_count,delivery_status_report,created_at")
      .eq("vendor_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ history: data ?? [] });
  } catch (error) {
    console.error("[notify/campaign:history]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    const body = (await request.json()) as CampaignBody;
    if (!body.message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const segment: CampaignSegment = body.segment === "repeat_buyers" ? "repeat_buyers" : "all_customers";

    const recipientsRes =
      segment === "repeat_buyers"
        ? await admin
            .from("customer_stats")
            .select("id,name,phone,total_orders")
            .eq("vendor_id", workspaceId)
            .gt("total_orders", 1)
        : await admin
            .from("customers")
            .select("id,name,phone")
            .eq("vendor_id", workspaceId);

    if (recipientsRes.error) {
      return NextResponse.json({ error: recipientsRes.error.message }, { status: 500 });
    }

    const recipients = (recipientsRes.data ?? []).filter((row) => Boolean((row.phone as string | null)?.trim()));

    const message = body.message.trim();
    const sendResults = await Promise.allSettled(
      recipients.map((recipient) => sendTextMessage(recipient.phone as string, message))
    );

    const sent = sendResults.filter((result) => result.status === "fulfilled" && result.value.ok).length;
    const failed = sendResults.length - sent;

    const { data: deliveryRows, error: deliveryError } = await admin
      .from("deliveries")
      .select("delivery_status, orders!inner(vendor_id)")
      .eq("orders.vendor_id", workspaceId)
      .in("delivery_status", ["not_dispatched", "dispatched", "in_transit", "delivered", "returned", "failed"])
      .order("created_at", { ascending: false })
      .limit(5000);

    if (deliveryError) {
      return NextResponse.json({ error: deliveryError.message }, { status: 500 });
    }

    const deliveryStatusReport: Record<string, number> = {
      not_dispatched: 0,
      dispatched: 0,
      in_transit: 0,
      delivered: 0,
      returned: 0,
      failed: 0,
    };

    for (const row of deliveryRows ?? []) {
      const key = row.delivery_status as keyof typeof deliveryStatusReport;
      if (deliveryStatusReport[key] !== undefined) {
        deliveryStatusReport[key] += 1;
      }
    }

    const { data: historyRow, error: historyError } = await admin
      .from("campaign_history")
      .insert({
        vendor_id: workspaceId,
        created_by: authResult.user.id,
        segment,
        message,
        recipient_count: recipients.length,
        sent_count: sent,
        failed_count: failed,
        delivery_status_report: deliveryStatusReport,
      })
      .select("id,created_at")
      .single();

    if (historyError) {
      return NextResponse.json({ error: historyError.message }, { status: 500 });
    }

    return NextResponse.json({
      segment,
      recipientCount: recipients.length,
      sent,
      failed,
      deliveryStatusReport,
      historyId: historyRow?.id ?? null,
      createdAt: historyRow?.created_at ?? null,
    });
  } catch (error) {
    console.error("[notify/campaign]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
