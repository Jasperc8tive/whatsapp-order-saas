"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  retryAllDeadJobs,
  retryQueueJob,
  type QueueHealthData,
  type QueueSortBy,
  type QueueSortDir,
  type QueueStatusFilter,
} from "@/lib/actions/queue-admin";

interface Props {
  initialData: QueueHealthData;
  error?: string;
}

export default function QueueHealthClient({ initialData, error }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(initialData.applied.search);
  const [pageInput, setPageInput] = useState(String(initialData.pagination.page));
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const rows = useMemo(() => initialData.rows, [initialData.rows]);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  }

  const updateQuery = useCallback((next: {
    page?: number;
    pageSize?: number;
    status?: QueueStatusFilter;
    q?: string;
    sortBy?: QueueSortBy;
    sortDir?: QueueSortDir;
  }) => {
    const params = new URLSearchParams(searchParams.toString());

    if (next.page !== undefined) {
      params.set("page", String(next.page));
    }
    if (next.pageSize !== undefined) {
      params.set("pageSize", String(next.pageSize));
      params.set("page", "1");
    }
    if (next.status !== undefined) {
      params.set("status", next.status);
      params.set("page", "1");
    }
    if (next.q !== undefined) {
      if (next.q.trim()) params.set("q", next.q.trim());
      else params.delete("q");
      params.set("page", "1");
    }

    if (next.sortBy !== undefined) {
      params.set("sortBy", next.sortBy);
      params.set("page", "1");
    }

    if (next.sortDir !== undefined) {
      params.set("sortDir", next.sortDir);
      params.set("page", "1");
    }

    router.push(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);

  function onSort(column: QueueSortBy) {
    const currentBy = initialData.applied.sortBy;
    const currentDir = initialData.applied.sortDir;
    const nextDir: QueueSortDir = currentBy === column && currentDir === "desc" ? "asc" : "desc";
    updateQuery({ sortBy: column, sortDir: nextDir });
  }

  function sortIndicator(column: QueueSortBy): string {
    if (initialData.applied.sortBy !== column) return "";
    return initialData.applied.sortDir === "asc" ? " ↑" : " ↓";
  }

  function onRetryJob(jobId: string) {
    startTransition(async () => {
      const result = await retryQueueJob(jobId);
      if (result.error) {
        showToast(result.error);
        return;
      }
      showToast("Job moved back to queue.");
      router.refresh();
    });
  }

  function onRetryDead() {
    startTransition(async () => {
      const result = await retryAllDeadJobs();
      if (result.error) {
        showToast(result.error);
        return;
      }
      showToast(`Retried ${result.retried ?? 0} dead jobs.`);
      router.refresh();
    });
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateQuery({ q: searchInput });
  }

  function onGoToPage(e: React.FormEvent) {
    e.preventDefault();
    const target = Number(pageInput);
    if (!Number.isFinite(target)) return;
    const bounded = Math.max(1, Math.min(totalPages, Math.floor(target)));
    updateQuery({ page: bounded });
  }

  const page = initialData.pagination.page;
  const totalPages = initialData.pagination.totalPages;
  const pageSize = initialData.pagination.pageSize;
  const total = initialData.pagination.total;
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  // Keep local controls in sync after URL navigation/refetch.
  useEffect(() => {
    setSearchInput(initialData.applied.search); // eslint-disable-line react-hooks/set-state-in-effect
  }, [initialData.applied.search]);

  useEffect(() => {
    setPageInput(String(initialData.pagination.page)); // eslint-disable-line react-hooks/set-state-in-effect
  }, [initialData.pagination.page]);

  // Debounced live search: update URL after typing pause.
  useEffect(() => {
    if (searchInput === initialData.applied.search) return;
    const timer = window.setTimeout(() => {
      updateQuery({ q: searchInput });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [searchInput, initialData.applied.search, updateQuery]);

  // Debounced page jump: update URL while typing page number.
  useEffect(() => {
    if (!pageInput) return;
    if (!/^\d+$/.test(pageInput)) return;

    const parsed = Number(pageInput);
    if (!Number.isFinite(parsed)) return;

    const bounded = Math.max(1, Math.min(totalPages, Math.floor(parsed)));
    if (bounded === page) return;

    const timer = window.setTimeout(() => {
      updateQuery({ page: bounded });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [pageInput, page, totalPages, updateQuery]);

  const statCard = (label: string, value: number, color: string) => (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Queue Health</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor worker queue and retry failed/dead jobs.</p>
        </div>
        <div className="flex items-center gap-2">
          <form onSubmit={onSearchSubmit} className="flex items-center gap-2">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search queue, status, error..."
              className="w-56 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300"
            />
            <button
              type="submit"
              disabled={isPending}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Search
            </button>
          </form>
          <button
            onClick={() => router.refresh()}
            disabled={isPending}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            onClick={onRetryDead}
            disabled={isPending || initialData.counts.dead === 0}
            className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            Retry All Dead
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCard("Queued", initialData.counts.queued, "text-yellow-600")}
        {statCard("Running", initialData.counts.running, "text-blue-600")}
        {statCard("Failed", initialData.counts.failed, "text-orange-600")}
        {statCard("Dead", initialData.counts.dead, "text-red-600")}
      </div>

      <div className="flex items-center gap-2 text-sm">
        {(["all", "queued", "running", "failed", "dead", "done"] as const).map((f) => (
          <button
            key={f}
            onClick={() => updateQuery({ status: f })}
            className={`px-3 py-1.5 rounded-lg border ${
              initialData.applied.status === f
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
        <p>
          Showing {startItem}-{endItem} of {total}
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="page-size" className="text-xs uppercase tracking-wide text-gray-400">Rows</label>
          <select
            id="page-size"
            value={pageSize}
            onChange={(e) => updateQuery({ pageSize: Number(e.target.value) })}
            className="px-2 py-1 border border-gray-300 rounded-lg bg-white"
          >
            {[20, 50, 100, 200].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Queue</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">
                  <button onClick={() => onSort("attempts")} className="hover:text-gray-700">
                    Attempts{sortIndicator("attempts")}
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-semibold">
                  <button onClick={() => onSort("run_at")} className="hover:text-gray-700">
                    Run At{sortIndicator("run_at")}
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-semibold">Error</th>
                <th className="text-left px-4 py-3 font-semibold">
                  <button onClick={() => onSort("created_at")} className="hover:text-gray-700">
                    Created{sortIndicator("created_at")}
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No jobs found for this filter.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{row.queue_name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        row.status === "queued" ? "bg-yellow-100 text-yellow-700" :
                        row.status === "running" ? "bg-blue-100 text-blue-700" :
                        row.status === "failed" ? "bg-orange-100 text-orange-700" :
                        row.status === "dead" ? "bg-red-100 text-red-700" :
                        "bg-green-100 text-green-700"
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{row.attempts} / {row.max_attempts}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(row.run_at).toLocaleString("en-NG")}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-sm truncate" title={row.last_error ?? ""}>
                      {row.last_error ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(row.created_at).toLocaleString("en-NG")}</td>
                    <td className="px-4 py-3">
                      {(row.status === "failed" || row.status === "dead") ? (
                        <button
                          onClick={() => onRetryJob(row.id)}
                          disabled={isPending}
                          className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Retry
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => updateQuery({ page: Math.max(1, page - 1) })}
          disabled={isPending || page <= 1}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
        <button
          onClick={() => updateQuery({ page: Math.min(totalPages, page + 1) })}
          disabled={isPending || page >= totalPages}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50"
        >
          Next
        </button>
        <form onSubmit={onGoToPage} className="flex items-center gap-1 ml-2">
          <label htmlFor="goto-page" className="text-sm text-gray-500">Go to</label>
          <input
            id="goto-page"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            className="w-14 px-2 py-1 text-sm border border-gray-300 rounded"
            inputMode="numeric"
          />
          <button
            type="submit"
            className="px-2 py-1 text-sm border border-gray-300 rounded"
            disabled={isPending}
          >
            Go
          </button>
        </form>
      </div>
    </div>
  );
}
