// Auto-assignment rules engine for orders
// Inputs: manager load, role, shift availability, zone tag


import type { Order } from "@/types/order";
import type { WorkspaceMember } from "@/types/team";
import type { AssignmentMetrics } from "@/lib/assignmentMetrics";
import { getAssignmentMetrics } from "@/lib/assignmentMetrics";
import { createAdminClient } from "@/lib/supabaseAdmin";


export interface AssignmentInput {
  order: Order;
  managers: WorkspaceMember[];
  // Optionally: shift info, zone, etc.
  vendorId: string;
}


export interface AssignmentResult {
  orderId: string;
  assignedTo: string | null;
  reason?: string;
  score?: number;
  explanations?: Array<{
    managerId: string;
    score: number;
    reason: string;
  }>;
}


// Assign to best manager using assignment metrics and load
export async function autoAssignOrder({ order, managers, vendorId }: AssignmentInput): Promise<AssignmentResult> {
  // 1. Filter eligible managers
  const eligible = managers.filter((m) => m.role === "delivery_manager" && m.is_active);
  if (eligible.length === 0) return { orderId: order.id, assignedTo: null, reason: "No eligible manager" };

  // 2. Fetch assignment metrics (last 30 days)
  const supabase = createAdminClient();
  let metrics: AssignmentMetrics[] = [];
  try {
    metrics = await getAssignmentMetrics(supabase, vendorId);
  } catch (e) {
    // fallback: no metrics
    metrics = [];
  }

  // 3. Compute score for each eligible manager
  // Lower load, lower reassign rate, lower SLA misses = better
  // Score = -(load) - (reassignRate*5) - (slaMisses*2)
  // (weights can be tuned)
  const explanations: AssignmentResult["explanations"] = [];
  let bestScore = -Infinity;
  let bestManager: WorkspaceMember | null = null;
  for (const m of eligible) {
    const mMetrics = metrics.find((mm) => mm.managerId === m.user_id);
    const load = mMetrics?.totalAssigned ?? 0;
    const reassignRate = mMetrics?.reassignRate ?? 0;
    const slaMisses = mMetrics?.slaMisses ?? 0;
    // Simple scoring formula
    const score = -load - reassignRate * 5 - slaMisses * 2;
    explanations.push({
      managerId: m.user_id,
      score,
      reason: `Load: ${load}, Reassign rate: ${reassignRate.toFixed(2)}, SLA misses: ${slaMisses}`
    });
    if (score > bestScore) {
      bestScore = score;
      bestManager = m;
    }
  }
  if (!bestManager) {
    return { orderId: order.id, assignedTo: null, reason: "No eligible manager (scoring)", explanations };
  }
  return {
    orderId: order.id,
    assignedTo: bestManager.user_id,
    reason: `Best score: ${bestScore} (see explanations)`,
    score: bestScore,
    explanations
  };
}


// Bulk assignment for many orders (async)
export async function autoAssignOrders(orders: Order[], managers: WorkspaceMember[], vendorId: string): Promise<AssignmentResult[]> {
  const results: AssignmentResult[] = [];
  for (const order of orders) {
    results.push(await autoAssignOrder({ order, managers, vendorId }));
  }
  return results;
}
