
"use client";
import { useOfflineOrders } from "@/lib/useOfflineOrders";
import { offlineDB } from "@/lib/utils";
import { useState } from "react";
import { EditOfflineOrderModal } from "@/components/EditOfflineOrderModal";

export function OfflineOrdersPanel() {
  const orders = useOfflineOrders();
  const [syncing, setSyncing] = useState(false);
  const [editing, setEditing] = useState<any|null>(null);

  async function syncAll() {
    setSyncing(true);
    for (const order of orders) {
      try {
        // Try to sync (simulate by removing offline flag)
        // In real app, call createManualOrder(order)
        await offlineDB.clearOrders();
        window.dispatchEvent(new Event("offline-order-changed"));
      } catch {}
    }
    setSyncing(false);
  }

  async function deleteOrder(id: string) {
    const all = await offlineDB.getOrders();
    await offlineDB.clearOrders();
    for (const o of all) {
      if (o.id !== id) await offlineDB.saveOrder(o);
    }
    window.dispatchEvent(new Event("offline-order-changed"));
  }

  function handleEdit(order: any) {
    setEditing(order);
  }

  function handleEditSave(updated: any) {
    setEditing(null);
    window.dispatchEvent(new Event("offline-order-changed"));
  }

  if (!orders.length) return null;
  return (
    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-yellow-800">Unsynced Orders ({orders.length})</span>
        <button
          className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
          onClick={syncAll}
          disabled={syncing}
        >
          {syncing ? "Syncing..." : "Sync Now"}
        </button>
      </div>
      <ul className="space-y-2">
        {orders.map((order) => (
          <li key={order.id} className="flex items-center justify-between bg-white rounded p-2 border border-yellow-100">
            <div>
              <div className="font-medium text-gray-800">{order.customerName}</div>
              <div className="text-xs text-gray-500">{order.items?.length ?? 0} items</div>
            </div>
            <div className="flex gap-2">
              <button
                className="text-blue-600 hover:underline text-xs"
                onClick={() => handleEdit(order)}
              >
                Edit
              </button>
              <button
                className="text-red-600 hover:underline text-xs"
                onClick={() => deleteOrder(order.id)}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
      {editing && (
        <EditOfflineOrderModal order={editing} onClose={() => setEditing(null)} onSave={handleEditSave} />
      )}
    </div>
  );
}
