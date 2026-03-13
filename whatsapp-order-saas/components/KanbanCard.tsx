"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Order } from "@/types/order";
import { formatCurrency, formatRelativeTime, ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from "@/lib/utils";

interface KanbanCardProps {
  order: Order;
  /** When true the card is rendered inside DragOverlay — no drag listeners */
  overlay?: boolean;
}

export default function KanbanCard({ order, overlay = false }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: order.id, data: { order } });

  const style = {
    transform: CSS.Translate.toString(transform),
    // Keep the card visible but ghost the original while the overlay follows cursor
    opacity: isDragging ? 0.35 : 1,
  };

  const firstItem = order.items[0];

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      className={[
        "bg-white rounded-xl border border-gray-200 p-4 select-none",
        overlay
          ? "shadow-2xl rotate-1 scale-105 border-green-300"
          : "hover:shadow-md transition-shadow",
        isDragging ? "cursor-grabbing" : "cursor-grab",
      ].join(" ")}
    >
      {/* Drag handle bar + header row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        {/* Drag grip — only attach listeners here so clicks inside don't trigger drag */}
        <div
          {...(!overlay ? { ...listeners, ...attributes } : {})}
          className="mt-0.5 flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors cursor-grab active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 100 4 2 2 0 000-4zm6 0a2 2 0 100 4 2 2 0 000-4zm-6 6a2 2 0 100 4 2 2 0 000-4zm6 0a2 2 0 100 4 2 2 0 000-4zm-6 6a2 2 0 100 4 2 2 0 000-4zm6 0a2 2 0 100 4 2 2 0 000-4z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono text-gray-400 leading-none mb-1">
            #{order.id.slice(0, 8).toUpperCase()}
          </p>
          <p className="font-semibold text-gray-800 text-sm leading-tight truncate">
            {order.customer_name}
          </p>
        </div>

        <span
          className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${ORDER_STATUS_COLORS[order.status]}`}
        >
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      {/* Product */}
      <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3">
        {firstItem ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-600 truncate">
              {firstItem.quantity}× {firstItem.product_name}
            </span>
            {order.items.length > 1 && (
              <span className="flex-shrink-0 text-[10px] text-gray-400 font-medium">
                +{order.items.length - 1} more
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-400">No items</span>
        )}
      </div>

      {/* Footer: amount + time */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-gray-900">
          {formatCurrency(order.total_amount)}
        </span>
        <div className="flex items-center gap-1 text-[10px] text-gray-400">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {formatRelativeTime(order.created_at)}
        </div>
      </div>

      {/* WhatsApp phone */}
      {order.customer_phone && (
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100">
          <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          <span className="text-[10px] text-gray-500 truncate">{order.customer_phone}</span>
        </div>
      )}
    </div>
  );
}
