import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

/**
 * GET /api/monitor/health
 *
 * System health check — returns DB connectivity, queue depths, and
 * required environment variable presence.
 *
 * Protected by the same WORKER_SECRET used by the job worker.
 * Safe to call from Vercel Cron (/api/jobs/worker is heavily requested by cron;
 * health is a secondary lightweight check).
 */
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const workerSecret = process.env.WORKER_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  const headerSecret = request.headers.get("x-worker-secret") ?? "";
  if (workerSecret && headerSecret === workerSecret) return true;

  const authz = request.headers.get("authorization") ?? "";
  if (cronSecret && authz === `Bearer ${cronSecret}`) return true;

  return false;
}

const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "PAYSTACK_SECRET_KEY",
  "WORKER_SECRET",
  "WHATSAPP_APP_SECRET",
];

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checks: Record<string, unknown> = {};
  let isHealthy = true;

  // 1. Database connectivity
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("users")
      .select("id")
      .limit(1)
      .maybeSingle();

    checks.database = error
      ? { status: "error", detail: error.message }
      : { status: "ok" };

    if (error) isHealthy = false;
  } catch (e) {
    checks.database = { status: "error", detail: String(e) };
    isHealthy = false;
  }

  // 2. Job queue depth (pending + failed-but-retriable)
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("job_queue")
      .select("queue_name, status")
      .in("status", ["queued", "running", "failed"]);

    if (error) throw error;

    const byQueue: Record<string, { queued: number; running: number; failed: number }> = {};
    for (const row of data ?? []) {
      const q = String(row.queue_name);
      if (!byQueue[q]) byQueue[q] = { queued: 0, running: 0, failed: 0 };
      const s = String(row.status) as "queued" | "running" | "failed";
      byQueue[q][s] += 1;
    }
    checks.job_queue = { status: "ok", by_queue: byQueue };
  } catch (e) {
    checks.job_queue = { status: "error", detail: String(e) };
    isHealthy = false;
  }

  // 3. Dead jobs count (permanently failed — needs manual intervention)
  try {
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("job_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "dead");

    checks.dead_jobs = error
      ? { status: "error", detail: error.message }
      : { status: "ok", count: count ?? 0 };
  } catch (e) {
    checks.dead_jobs = { status: "error", detail: String(e) };
  }

  // 4. Environment variable presence (never reveal values)
  const missingEnv = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
  checks.env = {
    status: missingEnv.length === 0 ? "ok" : "warning",
    missing: missingEnv,
  };
  if (missingEnv.length > 0) isHealthy = false;

  const status = isHealthy ? 200 : 503;
  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status }
  );
}
