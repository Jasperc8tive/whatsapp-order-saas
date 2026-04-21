"use client";

import { useDroppable } from "@dnd-kit/core";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import KanbanCard from "./KanbanCard";
import type { Order, OrderStatus } from "@/types/order";

interface ColumnConfig {
  id: OrderStatus;
  label: string;
  dotColor: string;
  countBg: string;
  countText: string;
  dropActiveBg: string;
  dropActiveBorder: string;
}

interface KanbanColumnProps {
  config: ColumnConfig;
  orders: Order[];
  workspaceId?: string;
  canUseAiSmartReplies?: boolean;
  isAnyDragging: boolean;
  onStatusChange?: (orderId: string, newStatus: OrderStatus) => void;
  updatingIds?: Set<string>;
  renderCard?: (order: Order) => React.ReactNode;
}

export default function KanbanColumn({ config, orders, workspaceId, canUseAiSmartReplies = false, isAnyDragging, onStatusChange, updatingIds, renderCard }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: config.id });
  const [cardsParentRef] = useAutoAnimate<HTMLDivElement>({
    duration: 220,
    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  });

  return (
    <div className="flex flex-col flex-shrink-0 w-72">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${config.dotColor}`} />
          <h3 className="text-sm font-semibold text-gray-700">{config.label}</h3>
        </div>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config.countBg} ${config.countText}`}
        >
          {orders.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={[
          "flex-1 min-h-[120px] rounded-xl transition-all duration-150 p-2 space-y-3",
          isOver
            ? `${config.dropActiveBg} ${config.dropActiveBorder} border-2 border-dashed`
            : isAnyDragging
            ? "border-2 border-dashed border-gray-200 bg-gray-50/50"
            : "border-2 border-dashed border-transparent",
        ].join(" ")}
      >
        <div ref={cardsParentRef} className="space-y-3">
          {orders.length === 0 ? (
            <div
              className={[
                "flex flex-col items-center justify-center h-24 rounded-lg text-xs font-medium transition-colors",
                isOver ? "text-gray-500" : "text-gray-300",
              ].join(" ")}
            >
              {isOver ? (
                <>
                  <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Drop here
                </>
              ) : (
                "No orders"
              )}
            </div>
          ) : renderCard ? (
            orders.map((order) => renderCard(order))
          ) : (
            orders.map((order) => (
              <KanbanCard
                key={order.id}
                order={order}
                workspaceId={workspaceId}
                canUseAiSmartReplies={canUseAiSmartReplies}
                onStatusChange={onStatusChange}
                isPending={updatingIds?.has(order.id)}
              />
            ))
          )}

          {/* Extra drop target at the bottom when column has cards */}
          {orders.length > 0 && isOver && (
            <div className="h-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
              <span className="text-xs text-gray-400 font-medium">Drop here</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Column config exported for use in KanbanBoard ────────────────────────────
export const COLUMN_CONFIGS: ColumnConfig[] = [
  {
    id: "pending",
    label: "New",
    dotColor: "bg-slate-400",
    countBg: "bg-slate-100",
    countText: "text-slate-600",
    dropActiveBg: "bg-slate-50",
    dropActiveBorder: "border-slate-300",
  },
  {
    id: "confirmed",
    label: "Paid",
    dotColor: "bg-emerald-400",
    countBg: "bg-emerald-100",
    countText: "text-emerald-700",
    dropActiveBg: "bg-emerald-50",
    dropActiveBorder: "border-emerald-300",
  },
  {
    id: "processing",
    label: "Processing",
    dotColor: "bg-violet-400",
    countBg: "bg-violet-100",
    countText: "text-violet-700",
    dropActiveBg: "bg-violet-50",
    dropActiveBorder: "border-violet-300",
  },
  {
    id: "shipped",
    label: "Shipped",
    dotColor: "bg-blue-400",
    countBg: "bg-blue-100",
    countText: "text-blue-700",
    dropActiveBg: "bg-blue-50",
    dropActiveBorder: "border-blue-300",
  },
  {
    id: "delivered",
    label: "Delivered",
    dotColor: "bg-green-500",
    countBg: "bg-green-100",
    countText: "text-green-700",
    dropActiveBg: "bg-green-50",
    dropActiveBorder: "border-green-300",
  },
];
