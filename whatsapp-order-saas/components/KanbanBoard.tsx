export default KanbanBoard;
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
import type { OrderAssignment } from "@/types/team";
import { getOrderAssignment, assignOrder } from "@/lib/actions/assignments";
import KanbanColumn, { COLUMN_CONFIGS } from "./KanbanColumn";
import type { Order, OrderStatus } from "@/types/order";
import { updateOrderStatus } from "@/lib/actions/orders";
import { formatCurrency } from "@/lib/utils";
import { getOrderPriorityScore } from "@/lib/orderPriority";
import BulkAssignButton from "./BulkAssignButton";
import { useEffect as useEffectReact, useState as useStateReact } from "react";

interface KanbanBoardProps {
  initialOrders: Order[];
  vendorId: string;
  canUseAiSmartReplies?: boolean;
}

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.35" } },
  }),
};

  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [managers, setManagers] = useStateReact<any[]>([]);
  const [showPreview, setShowPreview] = useStateReact(false);
  const [previewResults, setPreviewResults] = useStateReact<any[]>([]);
  const [queuePreset, setQueuePreset] = useState<string>("urgent");
  const [assignments, setAssignments] = useState<Record<string, OrderAssignment | null>>({});
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
    // Load assignments for all orders on mount
    useEffect(() => {
      async function fetchAssignments() {
        const result: Record<string, OrderAssignment | null> = {};
        await Promise.all(
          initialOrders.map(async (order) => {
            try {
              const res = await getOrderAssignment(order.id);
              result[order.id] = res.assignment ?? null;
            } catch {
              result[order.id] = null;
            }
          })
        );
        setAssignments(result);
      }
      fetchAssignments();
    }, [initialOrders]);

    // Fetch managers (delivery_manager role)
    useEffectReact(() => {
      async function fetchManagers() {
        const res = await fetch("/api/team/members");
        const data = await res.json();
        setManagers((data.members || []).filter((m: any) => m.role === "delivery_manager" && m.is_active));
      }
      fetchManagers();
    }, [vendorId]);
  const channelRef                    = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Supabase Realtime — keep board in sync without refresh
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    if (!vendorId) return;

    // Orders channel
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

    // Order assignments channel
    const assignmentChannel = supabase
      .channel(`order_assignments:vendor:${vendorId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_assignments",
          filter: `workspace_id=eq.${vendorId}`,
        },
        async (payload) => {
          const row = payload.new as { order_id: string };
          const res = await getOrderAssignment(row.order_id);
          setAssignments((prev) => ({ ...prev, [row.order_id]: res.assignment ?? null }));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "order_assignments",
          filter: `workspace_id=eq.${vendorId}`,
        },
        async (payload) => {
          const row = payload.new as { order_id: string };
          const res = await getOrderAssignment(row.order_id);
          setAssignments((prev) => ({ ...prev, [row.order_id]: res.assignment ?? null }));
        }
      )
      .subscribe();

    // Activity logs channel
    const activityChannel = supabase
      .channel(`activity_logs:vendor:${vendorId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_logs",
          filter: `workspace_id=eq.${vendorId}`,
        },
        (payload) => {
          // TODO: Optionally update activity feed or trigger UI notification
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(assignmentChannel);
      supabase.removeChannel(activityChannel);
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

  // Sorting logic for queue presets
  function sortOrders(orders: Order[]): Order[] {
    switch (queuePreset) {
      case "urgent":
        // Highest priority score first
        return [...orders].sort((a, b) => getOrderPriorityScore(b) - getOrderPriorityScore(a));
      case "oldest_unassigned":
        // Oldest created_at, unassigned first
        return [...orders].sort((a, b) => {
          const aAssigned = assignments[a.id] != null;
          const bAssigned = assignments[b.id] != null;
          if (aAssigned !== bAssigned) return aAssigned ? 1 : -1;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
      case "high_value":
        // Highest total_amount first
        return [...orders].sort((a, b) => b.total_amount - a.total_amount);
      default:
        return orders;
    }
  }

export function KanbanBoard({ initialOrders, vendorId, canUseAiSmartReplies }: KanbanBoardProps) {
  // ...existing code...
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

      {/* Board summary bar + queue preset switcher + bulk assign */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-5 text-sm text-gray-500">
                <span>
                  <BulkAssignButton
                    orders={orders.filter((o) => !assignments[o.id])}
                    managers={managers}
                    onPreview={(results) => {
                      setPreviewResults(results);
                      setShowPreview(true);
                    }}
                  />
                </span>
        <span>
          <span className="font-semibold text-gray-800">{orders.length}</span> orders
        </span>
        <span className="w-px h-4 bg-gray-200 hidden sm:block" />
        <span>
          <label htmlFor="queue-preset" className="mr-2 font-medium text-gray-600">Queue:</label>
          <select
            id="queue-preset"
            value={queuePreset}
            onChange={e => setQueuePreset(e.target.value)}
            className="border rounded px-2 py-0.5 text-xs font-semibold bg-white"
          >
            <option value="urgent">Urgent first</option>
            <option value="oldest_unassigned">Oldest unassigned</option>
            <option value="high_value">High value</option>
          </select>
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

      {/* Preview modal for bulk assignment */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full">
            <h3 className="text-lg font-semibold mb-3">Bulk Assignment Preview</h3>
            <div className="max-h-64 overflow-y-auto mb-4">
              {previewResults.length === 0 ? (
                <div className="text-gray-500">No eligible assignments.</div>
              ) : (
                <ul className="space-y-2">
                  {previewResults.map((r, i) => (
                    <li key={r.orderId || i} className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-gray-500">{r.orderId}</span>
                      <span className="text-gray-700">→</span>
                      <span className="font-semibold text-blue-700">{r.assignedTo || "—"}</span>
                      {r.reason && <span className="text-xs text-gray-400 ml-2">({r.reason})</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1 rounded bg-gray-200 text-gray-700 font-semibold" onClick={() => setShowPreview(false)}>Cancel</button>
              <button
                className="px-3 py-1 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700"
                onClick={async () => {
                  // Perform assignments for all previewed orders
                  for (const r of previewResults) {
                    if (r.orderId && r.assignedTo) {
                      await assignOrder(r.orderId, r.assignedTo, r.reason);
                    }
                  }
                  setShowPreview(false);
                  // Optionally: refresh assignments state
                  window.location.reload();
                }}
                disabled={previewResults.length === 0}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
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
              orders={sortOrders(orders.filter((o) => o.status === config.id))}
              workspaceId={vendorId}
              canUseAiSmartReplies={canUseAiSmartReplies}
              isAnyDragging={activeOrder !== null}
              onStatusChange={handleStatusChange}
              updatingIds={updatingIds}
              renderCard={(order) => (
                <KanbanCard
                  key={order.id}
                  order={order}
                  workspaceId={vendorId}
                  canUseAiSmartReplies={canUseAiSmartReplies}
                  assignment={assignments[order.id] ?? null}
                />
              )}
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
