import { useState } from "react";

interface SmartReplySuggestionsProps {
  orderId: string;
  customerMessage?: string;
  onSuggestionClick?: (suggestion: string) => void;
}

export default function SmartReplySuggestions({ orderId, customerMessage, onSuggestionClick }: SmartReplySuggestionsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchSuggestions() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orders/smart-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, customerMessage })
      });
      if (!res.ok) throw new Error("Failed to fetch suggestions");
      const data = await res.json();
      setSuggestions(data.suggestions || []);
      setConfidence(data.confidence ?? null);
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="my-4">
      <button
        className="px-3 py-1 bg-green-600 text-white rounded text-xs mb-2"
        onClick={fetchSuggestions}
        disabled={loading}
      >
        {loading ? "Loading…" : "Suggest WhatsApp Replies"}
      </button>
      {error && <div className="text-red-600 text-xs mt-2">{error}</div>}
      {suggestions.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded p-3 mt-2">
          <div className="text-xs text-gray-700 mb-1">AI Suggestions (confidence: {confidence !== null ? (confidence * 100).toFixed(0) + "%" : "n/a"})</div>
          <ul className="space-y-2">
            {suggestions.map((s, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="flex-1 text-sm">{s}</span>
                <button
                  className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                  onClick={() => onSuggestionClick?.(s)}
                >
                  Use
                </button>
                <button
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                  onClick={() => navigator.clipboard.writeText(s)}
                >
                  Copy
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
