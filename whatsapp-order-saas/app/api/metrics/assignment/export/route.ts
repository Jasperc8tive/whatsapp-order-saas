import { createAdminClient } from "@/lib/supabaseAdmin";
import { getAssignmentMetrics } from "@/lib/assignmentMetrics";
import { NextResponse } from "next/server";

function toCsv(metrics: any[]): string {
  if (!metrics.length) return "";
  const header = Object.keys(metrics[0]).join(",");
  const rows = metrics.map((m) => Object.values(m).map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
  return [header, ...rows].join("\n");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vendorId = searchParams.get("vendorId");
  const format = searchParams.get("format") || "json";
  if (!vendorId) return NextResponse.json({ error: "Missing vendorId" }, { status: 400 });

  const supabase = createAdminClient();
  const metrics = await getAssignmentMetrics(supabase, vendorId);

  if (format === "csv") {
    const csv = toCsv(metrics);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename=assignment_metrics_${vendorId}.csv`,
      },
    });
  }

  return NextResponse.json({ metrics });
}
