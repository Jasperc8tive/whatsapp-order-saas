
"use client";
import { useEffect, useState } from "react";

interface AssignmentMetrics {
  managerId: string;
  managerName: string | null;
  totalAssigned: number;
  totalReassigned: number;
  reassignRate: number;
  avgAssignmentDelayMins: number;
  slaMisses: number;
}

export default function AssignmentMetricsPanel({ vendorId }: { vendorId: string }) {
  const [metrics, setMetrics] = useState<AssignmentMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/metrics/assignment?vendorId=${vendorId}`);
        if (!res.ok) throw new Error("Failed to fetch metrics");
        const data = await res.json();
        setMetrics(data.metrics || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch metrics");
      } finally {
        setLoading(false);
      }
    }
    fetchMetrics();
  }, [vendorId]);

  if (loading) return <div className="py-8 text-center text-gray-500">Loading metrics...</div>;
  if (error) return <div className="py-8 text-center text-red-500">{error}</div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Supervisor Assignment Metrics (30 days)</h3>
        <a
          href={`/api/metrics/assignment/export?vendorId=${vendorId}&format=csv`}
          className="text-xs px-3 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 font-semibold"
          download
        >
          Export CSV
        </a>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left font-semibold">Manager</th>
              <th className="px-3 py-2 text-left font-semibold">Assigned</th>
              <th className="px-3 py-2 text-left font-semibold">Reassigned</th>
              <th className="px-3 py-2 text-left font-semibold">Reassign Rate</th>
              <th className="px-3 py-2 text-left font-semibold">SLA Misses</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.managerId} className="border-b last:border-0">
                <td className="px-3 py-2 font-mono">{m.managerName ?? m.managerId.slice(0, 8)}</td>
                <td className="px-3 py-2">{m.totalAssigned}</td>
                <td className="px-3 py-2">{m.totalReassigned}</td>
                <td className="px-3 py-2">{(m.reassignRate * 100).toFixed(1)}%</td>
                <td className="px-3 py-2">{m.slaMisses}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
