"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  generateSmartReplySuggestions,
  trackSmartReplyUsage,
} from "@/lib/actions/orders";

function toWaNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("0") && digits.length === 11
    ? `234${digits.slice(1)}`
    : digits;
}

interface OrderSmartRepliesPanelProps {
  orderId: string;
  customerPhone: string;
  canUseAiSmartReplies: boolean;
}

export default function OrderSmartRepliesPanel({
  orderId,
  customerPhone,
  canUseAiSmartReplies,
}: OrderSmartRepliesPanelProps) {
  const [isGenerating, startGenerating] = useTransition();
  const [latestCustomerMessage, setLatestCustomerMessage] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  // Supervisor review state: track approved/rejected for each suggestion
  const [reviewStatus, setReviewStatus] = useState<Record<number, 'approved' | 'rejected' | undefined>>({});
  const CONFIDENCE_THRESHOLD = 0.7;

  const waLink = customerPhone ? `https://wa.me/${toWaNumber(customerPhone)}` : null;

  function generateReplies() {
    if (!canUseAiSmartReplies) return;

    setError(null);
    setCopiedIndex(null);

    startGenerating(async () => {
      const result = await generateSmartReplySuggestions(
        orderId,
        latestCustomerMessage.trim() || undefined,
        "order_detail"
      );

      if (result.error) {
        setSuggestions([]);
        setConfidence(null);
        setError(result.error);
        return;
      }

      setSuggestions(result.data?.suggestions ?? []);
      setConfidence(result.data?.confidence ?? null);
    });
  }

  async function copySuggestion(text: string, index: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex((prev) => (prev === index ? null : prev)), 1500);
      void trackSmartReplyUsage(orderId, "copied", {
        surface: "order_detail",
        suggestion_index: index,
      });
    } catch {
      setError("Could not copy suggestion. Copy manually instead.");
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-700">Smart Replies</h3>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
          Pro
        </span>
      </div>

      {canUseAiSmartReplies ? (
        <>
          <p className="text-xs text-gray-500">
            Generate quick reply options for this customer conversation.
          </p>

          <textarea
            value={latestCustomerMessage}
            onChange={(e) => setLatestCustomerMessage(e.target.value)}
            rows={3}
            placeholder="Optional: paste the latest customer message"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-300"
          />

          <button
            type="button"
            onClick={generateReplies}
            disabled={isGenerating || !waLink}
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 text-white text-sm font-semibold px-4 py-2 hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {isGenerating ? "Generating..." : "Generate Smart Replies"}
          </button>

          {confidence !== null && (
            <p className="text-xs text-gray-500">Confidence: {Math.round(confidence * 100)}%</p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}

          {/* Route low-confidence drafts to review */}
          {confidence !== null && confidence < CONFIDENCE_THRESHOLD ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mt-2">
              <p className="text-xs text-amber-800 font-semibold">
                AI suggestions require supervisor review due to low confidence ({Math.round(confidence * 100)}%).
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Please review and approve these drafts before sending to the customer.
              </p>
              {suggestions.length > 0 && (
                <div className="space-y-2 mt-2">
                  {suggestions.map((reply, index) => (
                    <div
                      key={`${orderId}-review-suggestion-${index}`}
                      className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                    >
                      <p className="text-sm text-gray-700">{reply}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          type="button"
                          className={`text-xs font-semibold rounded px-2 py-1 ${reviewStatus[index]==='approved' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                          disabled={reviewStatus[index]==='approved'}
                          onClick={() => setReviewStatus((prev) => ({ ...prev, [index]: 'approved' }))}
                        >
                          {reviewStatus[index]==='approved' ? 'Approved' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          className={`text-xs font-semibold rounded px-2 py-1 ${reviewStatus[index]==='rejected' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                          disabled={reviewStatus[index]==='rejected'}
                          onClick={() => setReviewStatus((prev) => ({ ...prev, [index]: 'rejected' }))}
                        >
                          {reviewStatus[index]==='rejected' ? 'Rejected' : 'Reject'}
                        </button>
                      </div>
                      {reviewStatus[index]==='approved' && (
                        <div className="mt-2 text-xs text-green-700">This draft is approved for use.</div>
                      )}
                      {reviewStatus[index]==='rejected' && (
                        <div className="mt-2 text-xs text-red-700">This draft has been rejected.</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {/* Only show suggestions for direct use if confidence is high enough */}
          {confidence !== null && confidence >= CONFIDENCE_THRESHOLD && suggestions.length > 0 && (
            <div className="space-y-2">
              {suggestions.map((reply, index) => {
                const quickSendLink = waLink
                  ? `${waLink}?text=${encodeURIComponent(reply)}`
                  : null;

                return (
                  <div
                    key={`${orderId}-detail-suggestion-${index}`}
                    className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                  >
                    <p className="text-sm text-gray-700">{reply}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void copySuggestion(reply, index)}
                        className="text-xs font-semibold text-gray-600 hover:text-gray-900"
                      >
                        {copiedIndex === index ? "Copied" : "Copy"}
                      </button>
                      {quickSendLink && (
                        <a
                          href={quickSendLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            void trackSmartReplyUsage(orderId, "whatsapp_clicked", {
                              surface: "order_detail",
                              suggestion_index: index,
                            });
                          }}
                          className="text-xs font-semibold text-green-600 hover:text-green-700"
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
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-800">Smart Replies are available on Pro.</p>
          <Link
            href="/dashboard/billing?feature=smart-replies"
            className="mt-1 inline-block text-xs font-semibold text-amber-900 hover:text-amber-700"
          >
            Upgrade to Pro
          </Link>
        </div>
      )}
    </div>
  );
}
