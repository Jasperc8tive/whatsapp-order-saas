"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";


// --- Types ---
export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  created_at: string;
}

interface BulkActionsBarProps {
  selectedIds: string[];
  onClear: () => void;
  customers: CustomerRow[];
}

export default function BulkActionsBar({ selectedIds, onClear, customers }: BulkActionsBarProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBulkDelete() {
    if (!selectedIds.length) return;
    setLoading(true);
    setError(null);
    const { error: dbError } = await supabase.from("customers").delete().in("id", selectedIds);
    setLoading(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    onClear();
    window.location.reload();
  }

  function handleBulkExport() {
    const exportRows = customers.filter((c: CustomerRow) => selectedIds.includes(c.id));
    const csv = [
      ["Name", "Phone", "Added"],
      ...exportRows.map((c: CustomerRow) => [c.name, c.phone, c.created_at])
    ].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "customers.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex gap-3 items-center bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 mb-4">
      <span className="text-sm font-medium">{selectedIds.length} selected</span>
      <button
        onClick={handleBulkDelete}
        disabled={loading}
        className="bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-3 py-1 rounded-lg disabled:opacity-60"
      >
        {loading ? "Deleting…" : "Delete Selected"}
      </button>
      <button
        onClick={handleBulkExport}
        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1 rounded-lg"
      >
        Export Selected
      </button>
      <button
        onClick={onClear}
        className="text-xs text-gray-500 hover:underline ml-2"
      >
        Clear
      </button>
      {error && <span className="text-xs text-red-500 ml-2">{error}</span>}
    </div>
  );
}
