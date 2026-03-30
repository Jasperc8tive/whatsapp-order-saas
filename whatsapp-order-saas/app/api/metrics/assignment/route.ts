import { createAdminClient } from "@/lib/supabaseAdmin";
import { getAssignmentMetrics } from "@/lib/assignmentMetrics";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vendorId = searchParams.get("vendorId");
  if (!vendorId) return NextResponse.json({ error: "Missing vendorId" }, { status: 400 });

  const supabase = createAdminClient();
  const metrics = await getAssignmentMetrics(supabase, vendorId);
  return NextResponse.json({ metrics });
}
