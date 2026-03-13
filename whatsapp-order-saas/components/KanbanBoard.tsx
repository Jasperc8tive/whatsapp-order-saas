"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import KanbanCard from "./KanbanCard";
import KanbanColumn, { COLUMN_CONFIGS } from "./KanbanColumn";
import type { Order, OrderStatus } from "@/types/order";
import { updateOrderStatus } from "@/lib/actions/orders";

interface KanbanBoardProps {
  initialOrders: Order[];
}

export default function KanbanBoard({ initialOrders }: KanbanBoardProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  // Track in-flight updates so we can show per-card loading state if needed
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  // Show a toast-style error if the DB write fails
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Require 5px movement before drag starts — distinguishes drag from click
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const order = event.active.data.current?.order as Order | undefined;
    if (order) setActiveOrder(order);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveOrder(null);

      const { active, over } = event;
      if (!over) return;

      const draggedOrder = active.data.current?.order as Order | undefined;
      const targetStatus = over.id as OrderStatus;

      if (!draggedOrder || draggedOrder.status === targetStatus) return;

      // ── Optimistic update ─────────────────────────────────────────────────
      const previousStatus = draggedOrder.status;

      setOrders((prev) =>
        prev.map((o) =>
          o.id === draggedOrder.id
            ? { ...o, status: targetStatus, updated_at: new Date().toISOString() }
            : o
        )
      );
      setUpdatingIds((s) => new Set(s).add(draggedOrder.id));
      setErrorMsg(null);

      // ── Persist to Supabase ───────────────────────────────────────────────
      const result = await updateOrderStatus(draggedOrder.id, targetStatus);

      setUpdatingIds((s) => {
        const next = new Set(s);
        next.delete(draggedOrder.id);
        return next;
      });

      if (result.error) {
        // Revert on failure
        setOrders((prev) =>
          prev.map((o) =>
            o.id === draggedOrder.id ? { ...o, status: previousStatus } : o
          )
        );
        setErrorMsg(`Failed to update order: ${result.error}`);
      }
    },
    []
  );

  const boardTotal = orders.reduce((sum, o) => sum + o.total_amount, 0);

  return (
    <div>
      {/* Error toast */}
      {errorMsg && (
        <div className="mb-4 flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <span className="flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Board stats bar */}
      <div className="flex items-center gap-6 mb-5 text-sm text-gray-500">
        <span>
          <span className="font-semibold text-gray-800">{orders.length}</span> total orders
        </span>
        <span className="w-px h-4 bg-gray-200" />
        <span>
          Board value:{" "}
          <span className="font-semibold text-gray-800">
            {new Intl.NumberFormat("en-NG", {
              style: "currency",
              currency: "NGN",
              minimumFractionDigits: 0,
            }).format(boardTotal)}
          </span>
        </span>
        {updatingIds.size > 0 && (
          <>
            <span className="w-px h-4 bg-gray-200" />
            <span className="flex items-center gap-1.5 text-green-600">
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Saving…
            </span>
          </>
        )}
      </div>

      {/* Kanban board */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-6">
          {COLUMN_CONFIGS.map((config) => (
            <KanbanColumn
              key={config.id}
              config={config}
              orders={orders.filter((o) => o.status === config.id)}
              isAnyDragging={activeOrder !== null}
            />
          ))}
        </div>

        {/* Drag overlay — follows the cursor during drag */}
        <DragOverlay dropAnimation={null}>
          {activeOrder ? <KanbanCard order={activeOrder} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
