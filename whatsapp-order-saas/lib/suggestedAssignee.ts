import { autoAssignOrder } from "@/lib/autoAssignEngine";
import type { Order, OrderStatus } from "@/types/order";
import type { WorkspaceMember } from "@/types/team";

// Helper to fetch suggested assignee for an order
export async function getSuggestedAssignee(order: Order, managers: WorkspaceMember[], vendorId: string) {
  try {
    const result = await autoAssignOrder({ order, managers, vendorId });
    return result;
  } catch (e) {
    return { orderId: order.id, assignedTo: null, reason: "Suggestion failed", explanations: [] };
  }
}
