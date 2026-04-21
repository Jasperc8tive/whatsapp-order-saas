"use client";

import { useState } from "react";
import { generateOrderSummary } from "@/lib/actions/orders";

interface OrderSummaryPanelProps {
  orderId: string;
  canUseAiSummary: boolean;
}

export default function OrderSummaryPanel({
  orderId,
  canUseAiSummary,
}: OrderSummaryPanelProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateSummary = async () => {
    setIsLoading(true);
    setError(null);

    const result = await generateOrderSummary(orderId);
    if (result.error) {
      setError(result.error);
      setSummary(null);
    } else {
      setSummary(result.data ?? null);
    }

    setIsLoading(false);
  };

  const handleCopySummary = () => {
    if (summary) {
      navigator.clipboard.writeText(summary);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  if (!canUseAiSummary) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI Order Summary
            </h3>
            <p className="text-xs text-gray-500 mt-1">Auto-generate a summary of this order</p>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 rounded-full">
            <span className="text-xs font-semibold text-purple-700">Pro</span>
          </span>
        </div>
        <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
          <p className="text-xs text-purple-900">
            Upgrade to Pro to automatically generate order summaries with AI.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          AI Order Summary
        </h3>
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 rounded-full">
          <span className="text-xs font-semibold text-purple-700">Pro</span>
        </span>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 mb-3">
          {error}
        </div>
      )}

      {summary ? (
        <div>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 mb-3">
            <p className="text-sm text-gray-800">{summary}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopySummary}
              className="flex-1 text-xs font-medium px-3 py-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors flex items-center justify-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {isCopied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={handleGenerateSummary}
              disabled={isLoading}
              className="flex-1 text-xs font-medium px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Regenerate
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleGenerateSummary}
          disabled={isLoading}
          className="w-full text-sm font-medium px-4 py-2.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <svg
            className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {isLoading ? "Generating..." : "Generate Summary"}
        </button>
      )}
    </div>
  );
}
