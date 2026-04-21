import { createAdminClient } from "@/lib/supabaseAdmin";

export interface JobPayload {
  [key: string]: unknown;
}

export interface JobRow {
  id: string;
  queue_name: string;
  payload: JobPayload;
  status: "queued" | "running" | "done" | "failed" | "dead";
  attempts: number;
  max_attempts: number;
  run_at: string;
  last_error: string | null;
}

export async function enqueueJob(
  queueName: string,
  payload: JobPayload,
  runAt?: string,
  maxAttempts = 8
): Promise<{ jobId?: string; error?: string }> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("job_queue")
    .insert({
      queue_name: queueName,
      payload,
      run_at: runAt ?? new Date().toISOString(),
      max_attempts: maxAttempts,
      status: "queued",
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to enqueue job." };
  return { jobId: data.id as string };
}

export async function claimNextJob(queueName: string): Promise<JobRow | null> {
  const admin = createAdminClient();

  const nowIso = new Date().toISOString();
  
  // Sprint 1 Fix: Use atomic job claiming with SELECT FOR UPDATE SKIP LOCKED (Audit Finding #6 CRITICAL)
  // This prevents two workers from claiming the same job simultaneously
  
  // First, find a candidate job using SKIP LOCKED pattern via RPC or raw query
  // Since Supabase JS client doesn't support FOR UPDATE directly, we use a two-step approach:
  // 1. Select candidate with status check
  // 2. Try to update it atomically with status condition
  
  const { data: candidates } = await admin
    .from("job_queue")
    .select("id")
    .eq("queue_name", queueName)
    .in("status", ["queued", "failed"])
    .lt("attempts", 8)
    .lte("run_at", nowIso)
    .order("run_at", { ascending: true })
    .limit(5); // Get a few candidates to try

  const candidate = candidates?.[0];
  if (!candidate) return null;

  // Try to claim this specific job atomically
  const nextAttempts = Number(candidate.attempts ?? 0) + 1;

  const { data: claimed } = await admin
    .from("job_queue")
    .update({
      status: "running",
      attempts: nextAttempts,
      updated_at: nowIso,
    })
    .eq("id", candidate.id)
    .in("status", ["queued", "failed"]) // Only update if still in claimable state
    .select("*")
    .maybeSingle();

  if (!claimed) {
    // Another worker claimed it first, return null to retry
    return null;
  }

  return {
    id: claimed.id as string,
    queue_name: claimed.queue_name as string,
    payload: (claimed.payload ?? {}) as JobPayload,
    status: claimed.status as JobRow["status"],
    attempts: Number(claimed.attempts ?? 0),
    max_attempts: Number(claimed.max_attempts ?? 8),
    run_at: claimed.run_at as string,
    last_error: (claimed.last_error as string | null) ?? null,
  };
}

export async function completeJob(jobId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("job_queue")
    .update({ status: "done", updated_at: new Date().toISOString() })
    .eq("id", jobId);
}

export async function failJob(job: JobRow, errorMessage: string): Promise<void> {
  const admin = createAdminClient();

  const attempt = job.attempts;
  const maxAttempts = job.max_attempts;

  const backoffMs =
    attempt <= 1 ? 30_000 :
    attempt === 2 ? 120_000 :
    attempt === 3 ? 600_000 :
    attempt === 4 ? 1_800_000 :
    attempt === 5 ? 7_200_000 :
    attempt === 6 ? 21_600_000 :
    attempt === 7 ? 86_400_000 :
                    172_800_000;

  const nextStatus = attempt >= maxAttempts ? "dead" : "failed";
  const nextRunAt = new Date(Date.now() + backoffMs).toISOString();

  await admin
    .from("job_queue")
    .update({
      status: nextStatus,
      run_at: nextRunAt,
      last_error: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);
}
