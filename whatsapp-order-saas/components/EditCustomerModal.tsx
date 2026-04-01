"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// Nigeria phone number validation utility
function isValidNigerianPhone(phone: string): boolean {
  // Accepts: 080xxxxxxxx, 070xxxxxxxx, 081xxxxxxxx, 090xxxxxxxx, 091xxxxxxxx, or +2348xxxxxxxx, +2347xxxxxxxx, +2349xxxxxxxx, +2341xxxxxxxx
  // Must be 11 digits (local) or 14 (+234xxxxxxxxxx)
  const local = /^(080|070|081|090|091)\d{8}$/;
  const intl = /^\+234(80|70|81|90|91)\d{8}$/;
  return local.test(phone) || intl.test(phone);
}

export default function EditCustomerModal({ customer, onDone }: { customer: { id: string; name: string; phone: string; }, onDone?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: customer.name, phone: customer.phone });

  function openModal() {
    setForm({ name: customer.name, phone: customer.phone });
    setError(null);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    if (onDone) onDone();
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
    if (!isValidNigerianPhone(form.phone.trim())) {
      setError("Enter a valid Nigerian phone number (e.g. 08012345678 or +2348012345678)");
      return;
    }
    setLoading(true);
    setError(null);
    const { error: dbError } = await supabase.from("customers").update({
      name: form.name.trim(),
      phone: form.phone.trim(),
    }).eq("id", customer.id);
    setLoading(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    closeModal();
    router.refresh();
  }

  return (
    <>
      <button
        onClick={openModal}
        className="text-xs text-blue-600 hover:underline ml-2"
        title="Edit customer"
      >
        Edit
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-800">Edit Customer</h2>
              <button
                onClick={closeModal}
                aria-label="Close"
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="ec-name" className="block text-xs font-medium text-gray-600 mb-1">
                  Customer Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="ec-name"
                  name="name"
                  value={form.name}
                  onChange={change}
                  placeholder="e.g. Amara Okonkwo"
                  autoComplete="off"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label htmlFor="ec-phone" className="block text-xs font-medium text-gray-600 mb-1">
                  Phone Number <span className="text-red-400">*</span>
                </label>
                <input
                  id="ec-phone"
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
                  {loading ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
