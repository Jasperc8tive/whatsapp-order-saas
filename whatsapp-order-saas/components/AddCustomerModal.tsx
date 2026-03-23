"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Step = "form" | "success";

export default function AddCustomerModal({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [open, setOpen]       = useState(false);
  const [step, setStep]       = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [form, setForm]       = useState({ name: "", phone: "" });

  function openModal() {
    setForm({ name: "", phone: "" });
    setError(null);
    setStep("form");
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
  }

  function change(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.name.trim()) {
      setError("Customer name is required.");
      return;
    }
    if (!form.phone.trim()) {
      setError("Phone number is required.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error: dbError } = await supabase.from("customers").insert({
      vendor_id: vendorId,
      name:      form.name.trim(),
      phone:     form.phone.trim(),
    });

    setLoading(false);

    if (dbError) {
      console.error("[AddCustomerModal] insert error:", dbError);
      setError(dbError.message);
      return;
    }

    setStep("success");
    router.refresh();
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={openModal}
        className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        + Add Customer
      </button>

      {/* Modal backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-800">
                {step === "success" ? "Customer Added" : "Add Customer"}
              </h2>
              <button
                onClick={closeModal}
                aria-label="Close"
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* ── Success state ── */}
            {step === "success" ? (
              <div className="flex flex-col items-center py-4 gap-4">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gray-800">Customer saved!</p>
                  <p className="text-sm text-gray-500 mt-1">
                    <span className="font-medium text-gray-700">{form.name}</span> has been added to your customer list.
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (

            /* ── Form state ── */
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="ac-name" className="block text-xs font-medium text-gray-600 mb-1">
                  Customer Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="ac-name"
                  name="name"
                  value={form.name}
                  onChange={change}
                  placeholder="e.g. Amara Okonkwo"
                  autoComplete="off"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label htmlFor="ac-phone" className="block text-xs font-medium text-gray-600 mb-1">
                  Phone Number <span className="text-red-400">*</span>
                </label>
                <input
                  id="ac-phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={change}
                  placeholder="+2348012345678"
                  autoComplete="off"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {error && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  {loading ? "Saving…" : "Add Customer"}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
