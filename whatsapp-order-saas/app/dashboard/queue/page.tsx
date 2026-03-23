import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { listQueueHealth } from "@/lib/actions/queue-admin";
import QueueHealthClient from "./QueueHealthClient";

export const metadata = { title: "Queue Health" };

interface QueuePageProps {
  searchParams?: {
    page?: string;
    pageSize?: string;
    status?: "all" | "queued" | "running" | "failed" | "dead" | "done";
    q?: string;
    sortBy?: "created_at" | "run_at" | "attempts";
    sortDir?: "asc" | "desc";
  };
}

export default async function QueueHealthPage({ searchParams }: QueuePageProps) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const page = Number(searchParams?.page ?? "1");
  const pageSize = Number(searchParams?.pageSize ?? "50");
  const status = searchParams?.status ?? "all";
  const q = searchParams?.q ?? "";
  const sortBy = searchParams?.sortBy ?? "created_at";
  const sortDir = searchParams?.sortDir ?? "desc";

  const result = await listQueueHealth({
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 50,
    status,
    search: q,
    sortBy,
    sortDir,
  });

  const fallbackData = {
    counts: { queued: 0, failed: 0, dead: 0, running: 0 },
    rows: [],
    pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 },
    applied: { status: "all" as const, search: "", sortBy: "created_at" as const, sortDir: "desc" as const },
  };

  return (
    <QueueHealthClient
      initialData={result.data ?? fallbackData}
      error={result.error}
    />
  );
}
