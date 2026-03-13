"use client";

import { useState } from "react";
import OrderCard from "./OrderCard";
import type { Order, OrderStatus } from "@/types/order";
import { ORDER_STATUS_LABELS } from "@/lib/utils";

interface OrderBoardProps {
  initialOrders: Order[];
}

const BOARD_COLUMNS: OrderStatus[] = ["pending", "confirmed", "processing", "shipped", "delivered"];

export default function OrderBoard({ initialOrders }: OrderBoardProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);

  const handleStatusChange = (orderId: string, status: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status, updated_at: new Date().toISOString() } : o))
    );
    // TODO: persist to Supabase
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {BOARD_COLUMNS.map((status) => {
        const columnOrders = orders.filter((o) => o.status === status);
        return (
          <div key={status} className="flex-shrink-0 w-72">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">{ORDER_STATUS_LABELS[status]}</h3>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                {columnOrders.length}
              </span>
            </div>
            <div className="space-y-3">
              {columnOrders.length === 0 ? (
                <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-6 text-center text-xs text-gray-400">
                  No orders
                </div>
              ) : (
                columnOrders.map((order) => (
                  <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
