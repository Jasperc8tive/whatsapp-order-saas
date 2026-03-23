"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

export interface QueueJobRow {
  id: string;
  queue_name: string;
  status: "queued" | "running" | "done" | "failed" | "dead";
  attempts: number;
  max_attempts: number;
  run_at: string;
  created_at: string;
  last_error: string | null;
  payload: Record<string, unknown>;
}

export type QueueStatusFilter = "all" | "queued" | "running" | "failed" | "dead" | "done";
export type QueueSortBy = "created_at" | "run_at" | "attempts";
export type QueueSortDir = "asc" | "desc";

export interface QueueListOptions {
  page?: number;
  pageSize?: number;
  status?: QueueStatusFilter;
  search?: string;
  sortBy?: QueueSortBy;
  sortDir?: QueueSortDir;
}

export interface QueueHealthData {
  counts: {
    queued: number;
    failed: number;
    dead: number;
    running: number;
  };
  rows: QueueJobRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  applied: {
    status: QueueStatusFilter;
    search: string;
    sortBy: QueueSortBy;
    sortDir: QueueSortDir;
  };
}

export async function listQueueHealth(options: QueueListOptions = {}): Promise<{ data?: QueueHealthData; error?: string }> {
  const auth = await createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  // Owner-only view
  const { data: owner } = await admin
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!owner) return { error: "Only owners can view queue health." };

  const page = Math.max(1, Number(options.page ?? 1));
  const pageSize = Math.max(20, Math.min(200, Number(options.pageSize ?? 50)));
  const status: QueueStatusFilter = options.status ?? "all";
  const search = (options.search ?? "").trim();
  const sortBy: QueueSortBy = options.sortBy ?? "created_at";
  const sortDir: QueueSortDir = options.sortDir ?? "desc";

  // Overall health counts (not affected by search/filter)
  const [queuedCountRes, failedCountRes, deadCountRes, runningCountRes] = await Promise.all([
    admin.from("job_queue").select("id", { count: "exact", head: true }).eq("status", "queued"),
    admin.from("job_queue").select("id", { count: "exact", head: true }).eq("status", "failed"),
    admin.from("job_queue").select("id", { count: "exact", head: true }).eq("status", "dead"),
    admin.from("job_queue").select("id", { count: "exact", head: true }).eq("status", "running"),
  ]);

  let filteredCountQuery = admin.from("job_queue").select("id", { count: "exact", head: true });
  if (status !== "all") {
    filteredCountQuery = filteredCountQuery.eq("status", status);
  }
  if (search) {
    const escaped = search.replace(/,/g, " ");
    filteredCountQuery = filteredCountQuery.or(
      `queue_name.ilike.%${escaped}%,last_error.ilike.%${escaped}%,status.ilike.%${escaped}%`
    );
  }

  const filteredCountRes = await filteredCountQuery;
  const total = filteredCountRes.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const safeFrom = (safePage - 1) * pageSize;
  const safeTo = safeFrom + pageSize - 1;

  let rowsQuery = admin
    .from("job_queue")
    .select("id, queue_name, status, attempts, max_attempts, run_at, created_at, last_error, payload")
    .order(sortBy, { ascending: sortDir === "asc" })
    .range(safeFrom, safeTo);

  if (status !== "all") {
    rowsQuery = rowsQuery.eq("status", status);
  }

  if (search) {
    const escaped = search.replace(/,/g, " ");
    rowsQuery = rowsQuery.or(
      `queue_name.ilike.%${escaped}%,last_error.ilike.%${escaped}%,status.ilike.%${escaped}%`
    );
  }

  const { data: filteredRowsRaw, error: filteredRowsError } = await rowsQuery;
  if (filteredRowsError) return { error: filteredRowsError.message };

  const rows = (filteredRowsRaw ?? []) as QueueJobRow[];

  const counts = {
    queued: queuedCountRes.count ?? 0,
    failed: failedCountRes.count ?? 0,
    dead: deadCountRes.count ?? 0,
    running: runningCountRes.count ?? 0,
  };

  return {
    data: {
      counts,
      rows,
      pagination: {
        page: safePage,
        pageSize,
        total,
        totalPages,
      },
      applied: {
        status,
        search,
        sortBy,
        sortDir,
      },
    },
  };
}

export async function retryQueueJob(jobId: string): Promise<{ error?: string }> {
  const auth = await createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: owner } = await admin
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!owner) return { error: "Only owners can retry jobs." };

  const { error } = await admin
    .from("job_queue")
    .update({
      status: "queued",
      run_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .in("status", ["failed", "dead"]);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/queue");
  return {};
}

export async function retryAllDeadJobs(): Promise<{ retried?: number; error?: string }> {
  const auth = await createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: owner } = await admin
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!owner) return { error: "Only owners can retry jobs." };

  const { data, error } = await admin
    .from("job_queue")
    .update({
      status: "queued",
      run_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("status", "dead")
    .select("id");

  if (error) return { error: error.message };

  const retried = data?.length ?? 0;
  revalidatePath("/dashboard/queue");
  return { retried };
}
