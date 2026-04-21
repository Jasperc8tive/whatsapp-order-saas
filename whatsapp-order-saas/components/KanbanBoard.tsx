
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


function KanbanBoard({ initialOrders, vendorId, canUseAiSmartReplies }: KanbanBoardProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [managers, setManagers] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewResults, setPreviewResults] = useState<any[]>([]);
  const [queuePreset, setQueuePreset] = useState<string>("urgent");
  const [assignments, setAssignments] = useState<Record<string, OrderAssignment | null>>({});
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Render Kanban board UI (placeholder, replace with actual board JSX)
  return (
    <div>
      <h2>Kanban Board</h2>
      {/* Bulk Assign Button Example Usage */}
      <BulkAssignButton
        orders={orders}
        managers={managers}
        vendorId={vendorId}
        onPreview={(results) => {
          setPreviewResults(results);
          setShowPreview(true);
        }}
      />
      {/* TODO: Render columns, cards, drag-and-drop, etc. */}
    </div>
  );

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
  useEffect(() => {
    async function fetchManagers() {
      const res = await fetch("/api/team/members");
      const data = await res.json();
      setManagers((data.members || []).filter((m: any) => m.role === "delivery_manager" && m.is_active));
    }
    fetchManagers();
  }, [vendorId]);

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

// ...existing code...
// Ensure function is properly closed
}

export default KanbanBoard;
