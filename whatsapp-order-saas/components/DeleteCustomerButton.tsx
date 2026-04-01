"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function DeleteCustomerButton({ customerId, onDone }: { customerId: string, onDone?: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    const { error: dbError } = await supabase.from("customers").delete().eq("id", customerId);
    setLoading(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setConfirm(false);
    if (onDone) onDone();
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setConfirm(true)}
        className="text-xs text-red-600 hover:underline ml-2"
        title="Delete customer"
      >
        Delete
      </button>
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-2 sm:px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xs p-4 sm:p-6 text-center">
            <h2 className="text-base font-semibold text-gray-800 mb-2">Delete Customer?</h2>
            <p className="text-sm text-gray-600 mb-4">Are you sure you want to delete this customer? This action cannot be undone.</p>
            {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setConfirm(false)}
                className="border border-gray-200 text-gray-600 text-sm font-medium py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
