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
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ActivityFilters>(initialFilters);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    if (!vendorId) return;

    setLoading(true);
    setError(null);

    try {
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

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchActivities, 30000);
    return () => clearInterval(interval);
  }, [fetchActivities, autoRefresh]);

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
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-gray-900">Activity Timeline</h2>
        <p className="mt-1 text-sm text-gray-500">
          Real-time activity log of all operations and changes
        </p>
      </div>

      {/* Filters */}
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
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Types</option>
              <option value="order">Orders</option>
              <option value="assignment">Assignments</option>
              <option value="customer">Customers</option>
              <option value="user">Users</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Action
            </label>
            <select
              value={filters.action || ""}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  action: e.target.value || undefined,
                }))
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Actions</option>
              <option value="created">Created</option>
              <option value="updated">Updated</option>
              <option value="assigned">Assigned</option>
              <option value="reassigned">Reassigned</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Time Period
            </label>
            <select
              value={filters.dateRange || "all"}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  dateRange: e.target.value as ActivityFilters["dateRange"],
                }))
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="all">All Time</option>
            </select>
          </div>
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
          <div className="bg-gray-50 rounded-lg border border-gray-200 text-center py-12">
            <p className="text-sm text-gray-500">No activities found</p>
          </div>
        ) : (
          <div className="space-y-0">
            {activities.map((activity, index) => {
              const icon = actionIcons[activity.action] || "📝";
              const nextActivity = activities[index + 1];
              const showDateDivider =
                index === 0 ||
                new Date(activity.created_at).toDateString() !==
                  new Date(nextActivity?.created_at || activity.created_at).toDateString();

              return (
                <div key={activity.id}>
                  {showDateDivider && (
                    <div className="flex items-center justify-center my-4">
                      <div className="flex-1 border-t border-gray-200"></div>
                      <p className="px-3 text-xs font-semibold text-gray-500">
                        {new Date(activity.created_at).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <div className="flex-1 border-t border-gray-200"></div>
                    </div>
                  )}

                  <div className="flex gap-4 pb-4">
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-lg shadow-md">
                        {icon}
                      </div>
                      {index < activities.length - 1 && (
                        <div className="w-0.5 h-12 bg-gray-200 mt-2"></div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pt-1">
                      <div className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900">
                              {activity.description}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              by {activity.created_by_name || "System"}
                            </p>
                          </div>
                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded whitespace-nowrap flex-shrink-0 ${
                              entityTypeColors[activity.entity_type] ||
                              "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {activity.entity_type}
                          </span>
                        </div>

                        {/* Metadata */}
                        {Object.keys(activity.metadata).length > 0 && (
                          <div className="mt-2 bg-gray-50 rounded p-2 text-xs text-gray-600 space-y-1">
                            {Object.entries(activity.metadata).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="font-medium">{key}:</span>
                                <span className="text-gray-700">
                                  {typeof value === "object"
                                    ? JSON.stringify(value)
                                    : String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Timestamp */}
                        <p className="text-xs text-gray-400 mt-2">
                          {new Date(activity.created_at).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
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
