import { createAdminClient } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

export async function GET() {
  const admin = createAdminClient();
  const { data: jobs } = await admin
    .from("job_queue")
    .select("id, queue_name, status, attempts, max_attempts, run_at, last_error, payload, updated_at")
    .eq("queue_name", "notification_outbound")
    .order("run_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ jobs });
}
