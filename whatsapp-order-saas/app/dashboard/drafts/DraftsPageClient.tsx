"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { approveDraft, rejectDraft } from "@/lib/actions/drafts";
import DraftReviewModal from "@/components/DraftReviewModal";
import type { OrderDraft } from "@/lib/actions/drafts";

interface Props {
  initialDrafts: OrderDraft[];
  fetchError?: string;
}

const CONFIDENCE_COLOR = (c: number | null) => {
  if (c === null) return "bg-gray-100 text-gray-500";
  if (c >= 0.85)  return "bg-green-100 text-green-700";
  if (c >= 0.55)  return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-600";
};

function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  const pct = confidence !== null ? Math.round(confidence * 100) : null;
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CONFIDENCE_COLOR(confidence)}`}>
      {pct !== null ? `${pct}% confident` : "Unknown"}
    </span>
  );
}

export default function DraftsPageClient({ initialDrafts, fetchError }: Props) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [activeTab, setActiveTab] = useState<"pending_review" | "converted" | "rejected">("pending_review");
  const [selectedDraft, setSelectedDraft] = useState<OrderDraft | null>(null);
  const [rejectReason, setRejectReason]     = useState<Record<string, string>>({});
  const [expandedId, setExpandedId]         = useState<string | null>(null);
  const [toast, setToast]                   = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [isPending, startTransition]        = useTransition();

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  function handleApprove(draftId: string) {
    startTransition(async () => {
      const result = await approveDraft(draftId);
      if (result.error) {
        showToast("error", result.error);
      } else {
        setDrafts((prev) => prev.filter((d) => d.id !== draftId));
        showToast("success", `Order created successfully – #${result.orderId?.slice(0, 8).toUpperCase()}`);
      }
    });
  }

  function handleReject(draftId: string) {
    startTransition(async () => {
      const reason = rejectReason[draftId] ?? "";
      const result = await rejectDraft(draftId, reason || undefined);
      if (result.error) {
        showToast("error", result.error);
      } else {
        setDrafts((prev) => prev.filter((d) => d.id !== draftId));
        showToast("success", "Draft rejected.");
      }
    });
  }

  const pendingDrafts   = drafts.filter((d) => d.status === "pending_review");
  const convertedDrafts = drafts.filter((d) => d.status === "converted");
  const rejectedDrafts  = drafts.filter((d) => d.status === "rejected");

  const visibleDrafts =
    activeTab === "pending_review" ? pendingDrafts :
    activeTab === "converted"      ? convertedDrafts :
                                     rejectedDrafts;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Order Drafts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review AI-parsed orders from inbound WhatsApp messages before they go live.
          </p>
        </div>
        <Link
          href="/dashboard/settings/ai-capture"
          className="text-sm text-green-600 hover:text-green-800 font-medium underline underline-offset-2"
        >
          Configure AI Capture →
        </Link>
      </div>

      {fetchError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(["pending_review", "converted", "rejected"] as const).map((tab) => {
          const count =
            tab === "pending_review" ? pendingDrafts.length :
            tab === "converted"      ? convertedDrafts.length :
                                       rejectedDrafts.length;
          const label =
            tab === "pending_review" ? "Pending Review" :
            tab === "converted"      ? "Converted" : "Rejected";
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`ml-1.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                  activeTab === tab ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Draft list */}
      {visibleDrafts.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm text-gray-400">
            {activeTab === "pending_review"
              ? "No drafts pending review. New inbound WhatsApp orders will appear here."
              : `No ${activeTab.replace("_", " ")} drafts yet.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleDrafts.map((draft) => {
            const isExpanded = expandedId === draft.id;
            return (
              <div key={draft.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                {/* Card header */}
                <div
                  className="flex items-start justify-between p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : draft.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">
                        {draft.customer_name ?? draft.customer_phone}
                      </p>
                      {draft.customer_name && (
                        <span className="text-xs text-gray-400 font-mono">{draft.customer_phone}</span>
                      )}
                      <ConfidenceBadge confidence={draft.confidence} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(draft.created_at).toLocaleString("en-NG", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                    {draft.message_text && (
                      <p className="text-sm text-gray-600 mt-2 italic line-clamp-2">
                        &ldquo;{draft.message_text}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    {activeTab === "pending_review" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDraft(draft);
                        }}
                        className="text-xs font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        Review
                      </button>
                    )}
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4">
                    {/* Items */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Parsed Items</p>
                      {draft.items.length === 0 ? (
                        <p className="text-sm text-gray-400">No items parsed.</p>
                      ) : (
                        <div className="space-y-1">
                          {draft.items.map((item, i) => (
                            <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                              <span className="text-gray-700">{item.product_name}</span>
                              <span className="font-semibold text-gray-900">× {item.quantity}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {draft.notes && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Notes</p>
                        <p className="text-sm text-gray-600">{draft.notes}</p>
                      </div>
                    )}

                    {/* Actions */}
                    {activeTab === "pending_review" && (
                      <div className="space-y-3">
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleApprove(draft.id)}
                            disabled={isPending || draft.items.length === 0}
                            className="flex-1 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            ✓ Approve & Create Order
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Rejection reason (optional)"
                            value={rejectReason[draft.id] ?? ""}
                            onChange={(e) =>
                              setRejectReason((prev) => ({ ...prev, [draft.id]: e.target.value }))
                            }
                            className="flex-1 text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
                          />
                          <button
                            onClick={() => handleReject(draft.id)}
                            disabled={isPending}
                            className="px-4 py-2 text-sm font-semibold border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    )}

                    {draft.status === "converted" && draft.created_order_id && (
                      <Link
                        href={`/dashboard/orders/${draft.created_order_id}`}
                        className="inline-block text-sm text-green-600 hover:text-green-800 font-medium underline"
                      >
                        View created order →
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {selectedDraft && (
        <DraftReviewModal
          draft={selectedDraft}
          onClose={() => setSelectedDraft(null)}
          onSuccess={(orderId) => {
            const ref = orderId?.slice(0, 8).toUpperCase();
            showToast("success", `Order created${ref ? ` – #${ref}` : ""}!`);
            setDrafts((prev) => prev.filter((d) => d.id !== selectedDraft.id));
          }}
        />
      )}
    </div>
  );
}
