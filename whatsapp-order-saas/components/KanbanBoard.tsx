"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
  type DropAnimation,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import KanbanCard from "./KanbanCard";
import KanbanColumn, { COLUMN_CONFIGS } from "./KanbanColumn";
import type { Order, OrderStatus } from "@/types/order";
import { updateOrderStatus } from "@/lib/actions/orders";
import { formatCurrency } from "@/lib/utils";

interface KanbanBoardProps {
  initialOrders: Order[];
  vendorId: string;
}

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.35" } },
  }),
};

export default function KanbanBoard({ initialOrders, vendorId }: KanbanBoardProps) {
  const [orders, setOrders]         = useState<Order[]>(initialOrders);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const channelRef                    = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Supabase Realtime — keep board in sync without refresh
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    if (!vendorId) return;

    const channel = supabase
      .channel(`orders:vendor:${vendorId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `vendor_id=eq.${vendorId}`,
        },
        async (payload) => {
          const row = payload.new as Record<string, unknown>;

          let customerName = (row.customer_name as string | null) ?? "New Customer";
          let customerPhone = (row.customer_phone as string | null) ?? "";

          const customerId = (row.customer_id as string | null) ?? null;
          if (customerId && (customerName === "New Customer" || !customerPhone)) {
            const { data: customer } = await supabase
              .from("customers")
              .select("name, phone")
              .eq("id", customerId)
              .maybeSingle();

            if (customer) {
              customerName = customer.name ?? customerName;
              customerPhone = customer.phone ?? customerPhone;
            }
          }

          const newOrder: Order = {
            id: row.id as string,
            vendor_id: (row.vendor_id as string | null) ?? vendorId,
            customer_id: customerId ?? "",
            customer_name: customerName,
            customer_phone: customerPhone,
            status: ((row.order_status ?? row.status ?? "pending") as OrderStatus),
            total_amount: Number(row.total_amount ?? 0),
            items: [],
            created_at: (row.created_at as string | null) ?? new Date().toISOString(),
            updated_at: (row.updated_at as string | null) ?? new Date().toISOString(),
          };
          setOrders((prev) => {
            const idx = prev.findIndex((o) => o.id === newOrder.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = { ...next[idx], ...newOrder };
              return next;
            }
            return [newOrder, ...prev];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          setOrders((prev) =>
            prev.map((o) =>
              o.id === row.id
                ? {
                    ...o,
                    status: ((row.order_status ?? row.status ?? o.status) as OrderStatus),
                    total_amount: Number(row.total_amount ?? o.total_amount),
                    updated_at: (row.updated_at as string | null) ?? o.updated_at,
                  }
                : o
            )
          );
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const sensors = useSensors(
    // Pointer (mouse / stylus) — 5px threshold so clicks still work
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    // Touch — 250ms hold before drag activates (prevents scroll conflict on mobile)
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const order = event.active.data.current?.order as Order | undefined;
    if (order) setActiveOrder(order);
  }, []);

  const handleStatusChange = useCallback(async (orderId: string, newStatus: OrderStatus) => {
    let previousStatus: OrderStatus | null = null;
    let shouldUpdate = false;

    // Optimistic update from current state to avoid stale closure issues.
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        previousStatus = o.status;
        if (o.status === newStatus) return o;
        shouldUpdate = true;
        return { ...o, status: newStatus, updated_at: new Date().toISOString() };
      })
    );

    if (!shouldUpdate) return;

    setUpdatingIds((s) => new Set(s).add(orderId));
    setErrorMsg(null);

    const result = await updateOrderStatus(orderId, newStatus);

    setUpdatingIds((s) => {
      const next = new Set(s);
      next.delete(orderId);
      return next;
    });

    if (result.error && previousStatus) {
      const revertStatus = previousStatus;
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, status: revertStatus } : o
        )
      );
      setErrorMsg(`Failed to update order: ${result.error}`);
    }
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveOrder(null);

    const { active, over } = event;
    if (!over) return;

    const draggedOrder = active.data.current?.order as Order | undefined;
    const targetStatus = over.id as OrderStatus;

    if (!draggedOrder || draggedOrder.status === targetStatus) return;

    await handleStatusChange(draggedOrder.id, targetStatus);
  }, [handleStatusChange]);

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

      {/* Board summary bar */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-5 text-sm text-gray-500">
        <span>
          <span className="font-semibold text-gray-800">{orders.length}</span> orders
        </span>
        <span className="w-px h-4 bg-gray-200 hidden sm:block" />
        <span>
          Board value:{" "}
          <span className="font-semibold text-gray-800">{formatCurrency(boardTotal)}</span>
        </span>
        {updatingIds.size > 0 && (
          <>
            <span className="w-px h-4 bg-gray-200 hidden sm:block" />
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

      {/* Scroll hint on mobile */}
      <p className="text-xs text-gray-400 mb-3 lg:hidden">
        ← Scroll to see all columns · Hold a card to drag
      </p>

      {/* Kanban columns */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 md:gap-4 overflow-x-auto pb-6 -mx-4 px-4 md:mx-0 md:px-0">
          {COLUMN_CONFIGS.map((config) => (
            <KanbanColumn
              key={config.id}
              config={config}
              orders={orders.filter((o) => o.status === config.id)}
              isAnyDragging={activeOrder !== null}
              onStatusChange={handleStatusChange}
              updatingIds={updatingIds}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeOrder ? <KanbanCard order={activeOrder} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
