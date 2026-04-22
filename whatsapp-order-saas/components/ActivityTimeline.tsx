"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";

interface Activity {
  id: string;
  entity_type: "order" | "assignment" | "customer" | "user";
  entity_id: string;
  action: string;
  description: string;
  metadata: Record<string, any>;
  created_by_id: string;
  created_by_name?: string;
  created_at: string;
}

interface ActivityFilters {
  entityType?: string;
  action?: string;
  dateRange?: "today" | "week" | "month" | "all";
}

export default function ActivityTimeline({
  vendorId = "",
  filters: initialFilters = {},
  autoRefresh = true,
}: {
  vendorId?: string;
  filters?: ActivityFilters;
  autoRefresh?: boolean;
}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(!!vendorId);
  const [filters, setFilters] = useState<ActivityFilters>(initialFilters);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    if (!vendorId) return;

    try {
      setError(null);

      const params = new URLSearchParams();
      if (filters.entityType) params.append("entityType", filters.entityType);
      if (filters.action) params.append("action", filters.action);
      if (filters.dateRange && filters.dateRange !== "all") {
        params.append("dateRange", filters.dateRange);
      }
      params.append("vendorId", vendorId);

      const res = await fetch(`/api/activity?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch activities");

      const data = await res.json();
      setActivities(data.activities || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch activities");
    } finally {
      setLoading(false);
    }
  }, [vendorId, filters]);

  // ✅ FIXED: Proper async effect wrapper
  useEffect(() => {
    if (!vendorId) return;

    const load = async () => {
      await fetchActivities();
    };

    load();
  }, [fetchActivities, vendorId]);

  // ✅ FIXED: Stable interval + cleanup
  useEffect(() => {
    if (!autoRefresh || !vendorId) return;

    const interval = setInterval(() => {
      fetchActivities();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchActivities, autoRefresh, vendorId]);

  const actionIcons: Record<string, string> = {
    created: "✨",
    updated: "✏️",
    deleted: "🗑️",
    assigned: "👤",
    reassigned: "🔄",
    shipped: "📦",
    delivered: "✅",
    cancelled: "❌",
    completed: "🎉",
  };

  const entityTypeColors: Record<string, string> = {
    order: "bg-blue-100 text-blue-800",
    assignment: "bg-purple-100 text-purple-800",
    customer: "bg-green-100 text-green-800",
    user: "bg-gray-100 text-gray-800",
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        <p className="font-semibold">Failed to load activity</p>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Activity Timeline</h2>
        <p className="mt-1 text-sm text-gray-500">
          Real-time activity log of all operations and changes
        </p>
      </div>

      {/* Filters (unchanged) */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Entity Type
            </label>
            <select
              value={filters.entityType || ""}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  entityType: e.target.value || undefined,
                }))
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
            >
              <option value="">All Types</option>
              <option value="order">Orders</option>
              <option value="assignment">Assignments</option>
              <option value="customer">Customers</option>
              <option value="user">Users</option>
            </select>
          </div>

          {/* other filters unchanged */}
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin">⏳</div>
            <p className="mt-2 text-sm text-gray-500">Loading activities...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="bg-gray-50 rounded-lg border text-center py-12">
            <p className="text-sm text-gray-500">No activities found</p>
          </div>
        ) : (
          <div className="space-y-0">
            {activities.map((activity, index) => {
              const icon = actionIcons[activity.action] || "📝";

              return (
                <div key={activity.id} className="flex gap-4 pb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center">
                    {icon}
                  </div>

                  <div className="flex-1">
                    <p className="text-sm font-semibold">{activity.description}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(activity.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}