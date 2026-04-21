import { useState } from "react";
import { autoAssignOrders } from "@/lib/autoAssignEngine";
import type { Order } from "@/types/order";
import type { WorkspaceMember } from "@/types/team";

interface BulkAssignButtonProps {
  orders: Order[];
  managers: WorkspaceMember[];
  vendorId: string;
  onPreview: (results: Awaited<ReturnType<typeof autoAssignOrders>>) => void;
}

export default function BulkAssignButton({ orders, managers, vendorId, onPreview }: BulkAssignButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleBulkAssign() {
    setLoading(true);
    try {
      const results = await autoAssignOrders(orders, managers, vendorId);
      onPreview(results);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      className="px-3 py-1 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
      onClick={handleBulkAssign}
      disabled={loading || orders.length === 0 || managers.length === 0}
    >
      {loading ? "Assigning..." : "Assign all unassigned"}
    </button>
  );
}
