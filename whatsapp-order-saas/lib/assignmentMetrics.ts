import type { SupabaseClient } from "@supabase/supabase-js";

export interface AssignmentMetrics {
  managerId: string;
  managerName: string | null;
  totalAssigned: number;
  totalReassigned: number;
  reassignRate: number; // reassigns / totalAssigned
  avgAssignmentDelayMins: number;
  slaMisses: number;
}

/**
 * Computes assignment metrics for all managers in the last 30 days.
 */
export async function getAssignmentMetrics(
  supabase: SupabaseClient,
  vendorId: string
): Promise<AssignmentMetrics[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);

  // 1. Fetch all assignment/unassignment/reassignment events for this vendor
  const { data: logs } = await supabase
    .from("activity_logs")
    .select("actor_id, action, entity_id, created_at, meta")
    .eq("workspace_id", vendorId)
    .in("action", ["order_assigned", "order_reassigned", "order_unassigned", "order_sla_missed"])
    .gte("created_at", since.toISOString());

  if (!logs) return [];

  // 2. Group by manager (actor_id)
  const metricsMap = new Map<string, AssignmentMetrics>();

  for (const log of logs) {
    const managerId = log.actor_id;
    if (!managerId) continue;
    if (!metricsMap.has(managerId)) {
      metricsMap.set(managerId, {
        managerId,
        managerName: null, // can be enriched later
        totalAssigned: 0,
        totalReassigned: 0,
        reassignRate: 0,
        avgAssignmentDelayMins: 0,
        slaMisses: 0,
      });
    }
    const m = metricsMap.get(managerId)!;
    if (log.action === "order_assigned") m.totalAssigned++;
    if (log.action === "order_reassigned") m.totalReassigned++;
    if (log.action === "order_sla_missed") m.slaMisses++;
    // Assignment delay can be computed if meta has timestamps (not implemented here)
  }

  // Compute reassign rate
  for (const m of metricsMap.values()) {
    m.reassignRate = m.totalAssigned > 0 ? m.totalReassigned / m.totalAssigned : 0;
  }

  // TODO: Enrich managerName and compute avgAssignmentDelayMins if timestamps available

  return Array.from(metricsMap.values());
}
