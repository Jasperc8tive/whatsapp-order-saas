import { createAdminClient } from "@/lib/supabaseAdmin";
import { NextRequest, NextResponse } from "next/server";

function isAuthorized(request: NextRequest): boolean {
  const workerSecret = process.env.WORKER_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  const headerSecret = request.headers.get("x-worker-secret") ?? "";
  if (workerSecret && headerSecret === workerSecret) return true;

  const authz = request.headers.get("authorization") ?? "";
  if (cronSecret && authz === `Bearer ${cronSecret}`) return true;

  return false;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: jobs } = await admin
    .from("job_queue")
    .select("id, queue_name, status, attempts, max_attempts, run_at, last_error, payload, updated_at")
    .eq("queue_name", "notification_outbound")
    .order("run_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ jobs });
}
