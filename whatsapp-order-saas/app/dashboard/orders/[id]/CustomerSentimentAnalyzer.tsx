"use client";

import { useState } from "react";
import { analyzeSentiment, type SentimentType } from "@/lib/actions/orders";

interface CustomerSentimentAnalyzerProps {
  customerMessage?: string;
  canUseAiFeatures: boolean;
}

export default function CustomerSentimentAnalyzer({
  customerMessage,
  canUseAiFeatures,
}: CustomerSentimentAnalyzerProps) {
  const [sentiment, setSentiment] = useState<SentimentType | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!customerMessage || !canUseAiFeatures) {
    return null;
  }

  const handleAnalyzeSentiment = async () => {
    setIsAnalyzing(true);
    setError(null);

    const result = await analyzeSentiment(customerMessage);
    if (result.error) {
      setError(result.error);
      setSentiment(null);
    } else if (result.data) {
      setSentiment(result.data.sentiment);
      setConfidence(result.data.confidence);
    }

    setIsAnalyzing(false);
    setHasAnalyzed(true);
  };

  const getSentimentColor = (s: SentimentType | null): string => {
    switch (s) {
      case "positive":
        return "bg-green-100 text-green-800";
      case "negative":
        return "bg-red-100 text-red-800";
      case "neutral":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const getSentimentIcon = (s: SentimentType | null): string => {
    switch (s) {
      case "positive":
        return "😊";
      case "negative":
        return "😞";
      case "neutral":
        return "😐";
      default:
        return "❓";
    }
  };

  return (
    <div className="flex items-center gap-2">
      {!hasAnalyzed ? (
        <button
          onClick={handleAnalyzeSentiment}
          disabled={isAnalyzing}
          className="text-xs font-medium px-2.5 py-1.5 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          {isAnalyzing ? (
            <>
              <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                <path d="M12 2a10 10 0 010 20" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
              Analyzing...
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 7a3 3 0 11-6 0 3 3 0 016 0zM7 13a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
              Analyze Sentiment
            </>
          )}
        </button>
      ) : sentiment && !error ? (
        <div>
          <span
            className={`text-xs font-semibold px-2.5 py-1.5 rounded-full flex items-center gap-1.5 ${getSentimentColor(
              sentiment
            )}`}
          >
            <span>{getSentimentIcon(sentiment)}</span>
            <span className="capitalize">{sentiment}</span>
            <span className="text-opacity-70">({Math.round(confidence * 100)}%)</span>
          </span>
        </div>
      ) : error ? (
        <span className="text-xs text-red-600 px-2.5 py-1.5 bg-red-50 rounded-full">Failed to analyze</span>
      ) : null}
    </div>
  );
}
