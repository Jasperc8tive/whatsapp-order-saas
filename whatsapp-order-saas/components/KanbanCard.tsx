"use client";

import Link from "next/link";
import { useTransition, useState, useEffect } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Order, OrderStatus } from "@/types/order";
import type { OrderAssignment } from "@/types/team";
import { generateSmartReplySuggestions, trackSmartReplyUsage } from "@/lib/actions/orders";
import {
  formatCurrency,
  formatRelativeTime,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
} from "@/lib/utils";
import { getOrderAssignment } from "@/lib/actions/assignments";
import AssignmentBadge from "./AssignmentBadge";
import AssignmentModal from "./AssignmentModal";

const ALL_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

/** Strip non-digits; convert Nigerian local format (0XXXXXXXXXX → 234XXXXXXXXXX). */
function toWaNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("0") && digits.length === 11
    ? `234${digits.slice(1)}`
    : digits;
}



interface KanbanCardProps {
  order: Order;
  workspaceId?: string;
  canUseAiSmartReplies?: boolean;
  /** When true the card is rendered inside DragOverlay — no drag listeners */
  overlay?: boolean;
  onStatusChange?: (orderId: string, newStatus: OrderStatus) => void;
  isPending?: boolean;
}

export default function KanbanCard({
  order,
  workspaceId,
  canUseAiSmartReplies = false,
  overlay = false,
  onStatusChange,
  isPending = false,
}: KanbanCardProps) {
  const [localPending, startTransition] = useTransition();
  const isUpdating = isPending || localPending;

  // Assignment state
  const [assignment, setAssignment] = useState<OrderAssignment | null>(null);
  const [isLoadingAssignment, setIsLoadingAssignment] = useState(true);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);

  // Smart reply state
  const [isGeneratingReplies, startGeneratingReplies] = useTransition();
  const [latestCustomerMessage, setLatestCustomerMessage] = useState("");
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [replyConfidence, setReplyConfidence] = useState<number | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [copiedReplyIndex, setCopiedReplyIndex] = useState<number | null>(null);

  // Load assignment on mount
  useEffect(() => {
    async function loadAssignment() {
      try {
        const result = await getOrderAssignment(order.id);
        setAssignment(result.assignment ?? null);
      } catch (err) {
        console.error("Failed to load assignment:", err);
      } finally {
        setIsLoadingAssignment(false);
      }
    }
    loadAssignment();
  }, [order.id]);

  function handleStatusSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as OrderStatus;
    if (newStatus === order.status) return;
    if (onStatusChange) {
      onStatusChange(order.id, newStatus);
    }
  }

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: order.id, data: { order } });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.35 : 1,
  };

  const firstItem = order.items[0];

  // Build a wa.me link so vendors can tap the number and open WhatsApp immediately
  const waLink = order.customer_phone
    ? `https://wa.me/${toWaNumber(order.customer_phone)}`
    : null;

  function handleGenerateReplies() {
    if (!canUseAiSmartReplies || overlay) return;
    setReplyError(null);
    setCopiedReplyIndex(null);

    startGeneratingReplies(async () => {
      const result = await generateSmartReplySuggestions(
        order.id,
        latestCustomerMessage.trim() || undefined,
        "kanban_card"
      );

      if (result.error) {
        setSmartReplies([]);
        setReplyConfidence(null);
        setReplyError(result.error);
        return;
      }

      setSmartReplies(result.data?.suggestions ?? []);
      setReplyConfidence(result.data?.confidence ?? null);
    });
  }

  async function handleCopyReply(text: string, index: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedReplyIndex(index);
      setTimeout(() => setCopiedReplyIndex((i) => (i === index ? null : i)), 1500);
      void trackSmartReplyUsage(order.id, "copied", {
        surface: "kanban_card",
        suggestion_index: index,
      });
    } catch {
      setReplyError("Could not copy suggestion. Copy manually instead.");
    }
  }

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      className={[
        "bg-white rounded-xl border p-4 select-none",
        overlay
          ? "shadow-2xl rotate-1 scale-[1.03] border-green-300"
          : "border-gray-200 shadow-sm hover:shadow-md transition-shadow",
        isDragging ? "cursor-grabbing" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Header: drag grip + customer name + status badge */}
      <div className="flex items-start gap-2 mb-3">
        {/* Drag grip — only this element triggers drag, so tapping elsewhere works normally */}
        <div
          {...(!overlay ? { ...listeners, ...attributes } : {})}
          className="mt-0.5 flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors cursor-grab active:cursor-grabbing touch-none"
          aria-label="Drag to move"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 100 4 2 2 0 000-4zm6 0a2 2 0 100 4 2 2 0 000-4zm-6 6a2 2 0 100 4 2 2 0 000-4zm6 0a2 2 0 100 4 2 2 0 000-4zm-6 6a2 2 0 100 4 2 2 0 000-4zm6 0a2 2 0 100 4 2 2 0 000-4z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono text-gray-400 leading-none mb-0.5">
            #{order.id.slice(0, 8).toUpperCase()}
          </p>
          <p className="font-semibold text-gray-800 text-sm leading-tight truncate">
            {order.customer_name}
          </p>
        </div>

        {/* Status selector — click to change without dragging */}
        <div className="relative flex-shrink-0">
          <select
            value={order.status}
            onChange={handleStatusSelect}
            disabled={isUpdating || overlay}
            onClick={(e) => e.stopPropagation()}
            className={[
              "appearance-none text-[10px] font-semibold pl-2 pr-5 py-0.5 rounded-full cursor-pointer border-0 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-green-400 transition-opacity",
              ORDER_STATUS_COLORS[order.status],
              isUpdating ? "opacity-50" : "",
            ].filter(Boolean).join(" ")}
            aria-label="Change order status"
          >
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
            ))}
          </select>
          {isUpdating ? (
            <svg className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 animate-spin text-current opacity-60" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          ) : (
            <svg className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </div>

      {/* Product pill */}
      <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3">
        {firstItem ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-700 truncate font-medium">
              {firstItem.quantity}× {firstItem.product_name}
            </span>
            {order.items.length > 1 && (
              <span className="flex-shrink-0 text-[10px] text-gray-400 font-medium bg-gray-100 px-1.5 py-0.5 rounded-full">
                +{order.items.length - 1} more
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-400">No items</span>
        )}
      </div>

      {/* Footer: amount + time + assignment */}
      <div className="flex items-center justify-between mb-2">
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

      {/* Assignment */}
      {workspaceId && !overlay && (
        <div className="flex items-center gap-1 py-2 px-2 mb-2 bg-gray-50 rounded-lg">
          <span className="text-[10px] text-gray-500 font-medium">Assigned:</span>
          <AssignmentBadge
            assignment={assignment}
            isLoading={isLoadingAssignment}
            onClick={() => setShowAssignmentModal(true)}
          />
        </div>
      )}

      {/* WhatsApp phone — tappable link */}
      {order.customer_phone && (
        <div className="pt-2 border-t border-gray-100">
          {waLink ? (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 group w-fit"
              title={`Message ${order.customer_name} on WhatsApp`}
            >
              <svg
                className="w-3.5 h-3.5 text-green-500 flex-shrink-0 group-hover:text-green-600 transition-colors"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              <span className="text-[11px] text-gray-500 group-hover:text-green-600 transition-colors truncate">
                {order.customer_phone}
              </span>
            </a>
          ) : (
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              <span className="text-[11px] text-gray-500 truncate">{order.customer_phone}</span>
            </div>
          )}
        </div>
      )}

      {/* Pro AI Smart Reply suggestions */}
      {!overlay && (
        <div className="pt-2 mt-2 border-t border-gray-100 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold text-gray-600">Smart Replies</span>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
              Pro
            </span>
          </div>

          {canUseAiSmartReplies ? (
            <>
              <textarea
                value={latestCustomerMessage}
                onChange={(e) => setLatestCustomerMessage(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                rows={2}
                placeholder="Optional: paste latest customer message"
                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-300"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleGenerateReplies();
                }}
                disabled={isGeneratingReplies || !order.customer_phone}
                className="w-full rounded-lg bg-gray-900 text-white text-[11px] font-semibold py-1.5 hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {isGeneratingReplies ? "Generating..." : "Generate Smart Replies"}
              </button>

              {replyConfidence !== null && (
                <p className="text-[10px] text-gray-500">
                  Confidence: {Math.round(replyConfidence * 100)}%
                </p>
              )}

              {replyError && <p className="text-[10px] text-red-600">{replyError}</p>}

              {smartReplies.length > 0 && (
                <div className="space-y-1.5">
                  {smartReplies.map((reply, index) => {
                    const quickSendLink = waLink
                      ? `${waLink}?text=${encodeURIComponent(reply)}`
                      : null;

                    return (
                      <div key={`${order.id}-reply-${index}`} className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                        <p className="text-[11px] text-gray-700 leading-relaxed">{reply}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleCopyReply(reply, index);
                            }}
                            className="text-[10px] text-gray-600 hover:text-gray-900 font-medium"
                          >
                            {copiedReplyIndex === index ? "Copied" : "Copy"}
                          </button>
                          {quickSendLink && (
                            <a
                              href={quickSendLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                e.stopPropagation();
                                void trackSmartReplyUsage(order.id, "whatsapp_clicked", {
                                  surface: "kanban_card",
                                  suggestion_index: index,
                                });
                              }}
                              className="text-[10px] text-green-600 hover:text-green-700 font-medium"
                            >
                              Use in WhatsApp
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
              <p className="text-[10px] text-amber-800">
                Smart Replies are available on Pro.
              </p>
              <Link
                href="/dashboard/billing?feature=smart-replies"
                onClick={(e) => e.stopPropagation()}
                className="mt-1 inline-block text-[10px] font-semibold text-amber-900 hover:text-amber-700"
              >
                Upgrade to Pro
              </Link>
            </div>
          )}
        </div>
      )}

      {/* View order detail */}
      <div className="pt-2 mt-1 border-t border-gray-100">
        <Link
          href={`/dashboard/orders/${order.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-[11px] text-green-600 hover:text-green-700 font-medium transition-colors"
        >
          View details →
        </Link>
      </div>

      {/* Assignment modal */}
      {showAssignmentModal && workspaceId && (
        <AssignmentModal
          orderId={order.id}
          workspaceId={workspaceId}
          currentAssignment={assignment}
          onClose={() => setShowAssignmentModal(false)}
          onAssigned={() => {
            // Refresh assignment data after assignment is changed
            getOrderAssignment(order.id).then((result) => {
              setAssignment(result.assignment ?? null);
            });
          }}
        />
      )}
    </div>
  );
}
