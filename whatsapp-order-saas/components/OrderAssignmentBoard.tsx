"use client";

import { useState } from "react";

interface Order {
  id: string;
  order_status: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  created_at: string;
  assignment?: {
    assigned_to: string;
    assigned_by: string;
    assigned_to_name?: string;
  };
}

interface DeliveryManager {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  role: "delivery_manager";
}

export default function OrderAssignmentBoard({
  orders = [],
  deliveryManagers = [],
  currentUserId = "",
}: {
  orders?: Order[];
  deliveryManagers?: DeliveryManager[];
  currentUserId?: string;
}) {
  const [ordersList, setOrdersList] = useState<Order[]>(orders);
  const [draggedOrder, setDraggedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const unassignedOrders = ordersList.filter(
    (o) => !o.assignment || !o.assignment.assigned_to
  );
  const assignedOrders = ordersList.filter(
    (o) => o.assignment && o.assignment.assigned_to
  );

  function handleDragStart(order: Order) {
    setDraggedOrder(order);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  async function handleDrop(managerId: string) {
    if (!draggedOrder) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/orders/${draggedOrder.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedToUserId: managerId,
          reason: "Assigned via queue board",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to assign order");
      }

      // Update local state
      setOrdersList((prev) =>
        prev.map((o) =>
          o.id === draggedOrder.id
            ? {
                ...o,
                assignment: {
                  assigned_to: managerId,
                  assigned_by: currentUserId,
                  assigned_to_name:
                    deliveryManagers.find((dm) => dm.user_id === managerId)
                      ?.display_name || "Unknown",
                },
              }
            : o
        )
      );

      setSuccess(
        `Order assigned to ${deliveryManagers.find((dm) => dm.user_id === managerId)?.display_name || "delivery manager"}`
      );
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setDraggedOrder(null);
    }
  }

  async function handleUnassign(orderId: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/orders/${orderId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedToUserId: "",
          reason: "Unassigned via queue board",
        }),
      });

      if (!res.ok) throw new Error("Failed to unassign");

      setOrdersList((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, assignment: undefined } : o
        )
      );

      setSuccess("Order unassigned");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-blue-100 text-blue-800",
    processing: "bg-purple-100 text-purple-800",
    shipped: "bg-green-100 text-green-800",
    delivered: "bg-gray-100 text-gray-800",
    cancelled: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Delivery Queue</h1>
        <p className="mt-1 text-sm text-gray-500">
          Drag orders to delivery managers to assign. {unassignedOrders.length} unassigned
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Kanban board */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Unassigned column */}
        <div
          onDragOver={handleDragOver}
          className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-4 min-h-[500px] overflow-y-auto"
        >
          <h2 className="font-semibold text-gray-900 mb-4 text-sm uppercase tracking-wider">
            Unassigned Orders
            <span className="ml-2 inline-block bg-gray-200 text-gray-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
              {unassignedOrders.length}
            </span>
          </h2>

          <div className="space-y-3">
            {unassignedOrders.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">No unassigned orders</p>
            ) : (
              unassignedOrders.map((order) => (
                <div
                  key={order.id}
                  draggable
                  onDragStart={() => handleDragStart(order)}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-3 cursor-move hover:shadow-md hover:border-gray-400 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {order.customer_name || "Unknown"}
                      </p>
                      <p className="text-xs text-gray-500">{order.customer_phone}</p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded whitespace-nowrap flex-shrink-0 ${
                        statusColors[order.order_status as keyof typeof statusColors] ||
                        "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {order.order_status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">₦{order.total_amount.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(order.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Delivery manager columns */}
        <div className="space-y-4 lg:col-span-1">
          {deliveryManagers.map((manager) => {
            const managerOrders = assignedOrders.filter(
              (o) => o.assignment?.assigned_to === manager.user_id
            );
            return (
              <div
                key={manager.id}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(manager.user_id)}
                className="bg-white rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 p-4 min-h-[220px] overflow-y-auto"
              >
                <h3 className="font-semibold text-gray-900 mb-3 text-sm">
                  {manager.display_name || manager.email}
                  <span className="ml-2 inline-block bg-blue-200 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                    {managerOrders.length}
                  </span>
                </h3>

                <div className="space-y-2">
                  {managerOrders.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-8">
                      Drop orders here
                    </p>
                  ) : (
                    managerOrders.map((order) => (
                      <div
                        key={order.id}
                        className="bg-white border border-blue-200 rounded-lg p-3 hover:shadow-sm transition-shadow group"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate peer">
                              {order.customer_name || "Unknown"}
                            </p>
                            <p className="text-xs text-gray-500">{order.customer_phone}</p>
                          </div>
                          <button
                            onClick={() => handleUnassign(order.id)}
                            disabled={loading}
                            className="text-red-600 hover:text-red-800 opacity-0 group-hover:opacity-100 duration-200 disabled:opacity-50 text-xs font-medium"
                            title="Unassign"
                          >
                            ×
                          </button>
                        </div>
                        <p className="text-xs text-gray-600">
                          ₦{order.total_amount.toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
        <strong>Tip:</strong> Drag unassigned orders from the left column to a delivery
        manager&apos;s queue on the right. Click × to unassign.
      </div>
    </div>
  );
}
