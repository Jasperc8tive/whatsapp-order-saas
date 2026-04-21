import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { getCurrentWorkspaceRole } from "@/lib/workspace";
import { getAssignmentMetrics } from "@/lib/assignmentMetrics";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getCurrentWorkspaceRole(user.id);
  if (role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const vendorId = searchParams.get("vendorId");
  if (!vendorId) return NextResponse.json({ error: "Missing vendorId" }, { status: 400 });

  const admin = createAdminClient();
  const metrics = await getAssignmentMetrics(admin, vendorId);
  return NextResponse.json({ metrics });
}
