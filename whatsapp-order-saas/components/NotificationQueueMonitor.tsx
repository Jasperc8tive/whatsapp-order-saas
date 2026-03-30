import { useEffect, useState } from "react";

interface JobRow {
  id: string;
  queue_name: string;
  status: string;
  attempts: number;
  max_attempts: number;
  run_at: string;
  last_error: string | null;
  payload: any;
  updated_at: string;
}

export default function NotificationQueueMonitor() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchJobs() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/monitor/notification-queue");
        if (!res.ok) throw new Error("Failed to fetch jobs");
        const data = await res.json();
        setJobs(data.jobs || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch jobs");
      } finally {
        setLoading(false);
      }
    }
    fetchJobs();
  }, []);

  async function retryJob(id: string) {
    await fetch(`/api/monitor/notification-queue/retry?id=${id}`, { method: "POST" });
    // Refresh jobs
    const res = await fetch("/api/monitor/notification-queue");
    const data = await res.json();
    setJobs(data.jobs || []);
  }

  if (loading) return <div className="py-8 text-center text-gray-500">Loading queue...</div>;
  if (error) return <div className="py-8 text-center text-red-500">{error}</div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mt-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Notification Queue Monitor</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-2 py-1 text-left font-semibold">ID</th>
              <th className="px-2 py-1 text-left font-semibold">Status</th>
              <th className="px-2 py-1 text-left font-semibold">Attempts</th>
              <th className="px-2 py-1 text-left font-semibold">Run At</th>
              <th className="px-2 py-1 text-left font-semibold">Last Error</th>
              <th className="px-2 py-1 text-left font-semibold">Type</th>
              <th className="px-2 py-1 text-left font-semibold">Recipient</th>
              <th className="px-2 py-1 text-left font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className={job.status === "dead" ? "bg-red-50" : job.status === "failed" ? "bg-yellow-50" : ""}>
                <td className="px-2 py-1 font-mono">{job.id.slice(0, 8)}</td>
                <td className="px-2 py-1">{job.status}</td>
                <td className="px-2 py-1">{job.attempts}/{job.max_attempts}</td>
                <td className="px-2 py-1">{new Date(job.run_at).toLocaleString()}</td>
                <td className="px-2 py-1 text-xs text-red-700 max-w-xs truncate">{job.last_error}</td>
                <td className="px-2 py-1">{job.payload?.type}</td>
                <td className="px-2 py-1">{job.payload?.recipient}</td>
                <td className="px-2 py-1">
                  {(job.status === "failed" || job.status === "dead") && (
                    <button
                      className="px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs font-semibold"
                      onClick={() => retryJob(job.id)}
                    >
                      Retry
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
