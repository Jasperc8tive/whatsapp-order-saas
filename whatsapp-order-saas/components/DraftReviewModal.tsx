"use client";

import { useState, useTransition } from "react";
import { approveDraft, rejectDraft } from "@/lib/actions/drafts";
import type { OrderDraft } from "@/lib/actions/drafts";

interface DraftReviewModalProps {
  draft: OrderDraft;
  onClose: () => void;
  onSuccess: (orderId?: string) => void;
}

const CONFIDENCE_COLOR = (c: number | null) => {
  if (c === null) return "bg-gray-100 text-gray-500";
  if (c >= 0.85) return "bg-green-100 text-green-700";
  if (c >= 0.55) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-600";
};

function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  const pct = confidence !== null ? Math.round(confidence * 100) : null;
  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${CONFIDENCE_COLOR(confidence)}`}>
      {pct !== null ? `${pct}% confident` : "Unknown"}
    </span>
  );
}

export default function DraftReviewModal({
  draft,
  onClose,
  onSuccess,
}: DraftReviewModalProps) {
  const [step, setStep] = useState<"review" | "reject">("review");
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const items = (draft.items as Array<any>) || [];
  const totalItems = items.reduce((sum, item) => sum + (item.quantity || 1), 0);

  function handleApprove() {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await approveDraft(draft.id);
      if (result.error) {
        setError(result.error);
      } else {
        onSuccess(result.orderId);
        onClose();
      }
    });
  }

  function handleRejectClick() {
    setStep("reject");
    setError(null);
  }

  function handleConfirmReject() {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await rejectDraft(draft.id, rejectReason || undefined);
      if (result.error) {
        setError(result.error);
      } else {
        onSuccess();
        onClose();
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {step === "review" ? "Review Draft Order" : "Reject Draft"}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {step === "review"
                ? `From ${draft.customer_phone || "Unknown"} • ${totalItems} item${totalItems !== 1 ? "s" : ""}`
                : "Provide a reason for rejection (optional)"}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none disabled:opacity-50"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-5">
            {error}
          </div>
        )}

        {step === "review" ? (
          <>
            {/* Confidence Badge */}
            <div className="mb-6 flex items-center gap-3">
              <span className="text-xs font-medium text-gray-600">AI Confidence:</span>
              <ConfidenceBadge confidence={draft.confidence} />
            </div>

            {/* Customer Info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Customer Info</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Name</p>
                  <p className="text-gray-900 font-medium">{draft.customer_name || "Not provided"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Phone</p>
                  <p className="text-gray-900 font-medium">{draft.customer_phone}</p>
                </div>
              </div>
              {draft.notes && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-gray-500 text-xs">Notes</p>
                  <p className="text-gray-900 mt-1">{draft.notes}</p>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Items</h3>
              <div className="space-y-2">
                {items.length > 0 ? (
                  items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between bg-gray-50 rounded-lg p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {item.product_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          Qty: {item.quantity || 1}
                        </p>
                      </div>
                      <p className="text-sm text-gray-600 flex-shrink-0">
                        {item.quantity || 1} ×
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No items in draft</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={isPending}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                {isPending ? "Creating order..." : "Approve & Create Order"}
              </button>
              <button
                onClick={handleRejectClick}
                disabled={isPending}
                className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 font-medium py-2.5 rounded-lg transition-colors"
              >
                Reject
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Reject Reason Form */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for rejection (optional)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g., Customer requested to cancel, unclear items, duplicate order..."
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  rows={4}
                  disabled={isPending}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleConfirmReject}
                disabled={isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                {isPending ? "Rejecting..." : "Confirm Rejection"}
              </button>
              <button
                onClick={() => setStep("review")}
                disabled={isPending}
                className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 font-medium py-2.5 rounded-lg transition-colors"
              >
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
