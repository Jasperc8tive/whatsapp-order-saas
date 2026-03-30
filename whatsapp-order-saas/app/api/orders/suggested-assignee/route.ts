import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getSuggestedAssignee } from "@/lib/suggestedAssignee";
import { Order } from "@/types/order";
import { WorkspaceMember } from "@/types/team";

// POST /api/orders/suggested-assignee
export async function POST(req: NextRequest) {
  try {
    const { order, managers, vendorId } = await req.json();
    if (!order || !managers || !vendorId) {
      return NextResponse.json({ error: "Missing order, managers, or vendorId" }, { status: 400 });
    }
    const result = await getSuggestedAssignee(order as Order, managers as WorkspaceMember[], vendorId as string);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: "Failed to get suggestion" }, { status: 500 });
  }
}
