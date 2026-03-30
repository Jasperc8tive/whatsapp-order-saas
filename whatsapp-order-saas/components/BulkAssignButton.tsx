import { useState } from "react";
import { autoAssignOrders } from "@/lib/autoAssignEngine";
import type { Order } from "@/types/order";
import type { WorkspaceMember } from "@/types/team";

export default function BulkAssignButton({ orders, managers, onPreview }: {
  orders: Order[];
  managers: WorkspaceMember[];
  onPreview: (results: ReturnType<typeof autoAssignOrders>) => void;
}) {
  const [loading, setLoading] = useState(false);

  function handleBulkAssign() {
    setLoading(true);
    const results = autoAssignOrders(orders, managers);
    setLoading(false);
    onPreview(results);
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
