"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  autofillManualOrderFromChat,
  createManualOrder,
  type ManualOrderInput,
} from "@/lib/actions/orders";
import Link from "next/link";

interface LineItem {
  product_name: string;
  quantity: number;
  price: number;
}

const emptyItem = (): LineItem => ({ product_name: "", quantity: 1, price: 0 });

type Step = "form" | "success";

export default function NewOrderModal({
  vendorId,
  canUseAiAutofill,
}: {
  vendorId: string;
  canUseAiAutofill: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen]         = useState(false);
  const [step, setStep]         = useState<Step>("form");
  const [loading, setLoading]   = useState(false);
  const [autofillLoading, setAutofillLoading] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [chatText, setChatText] = useState("");
  const [autofillMeta, setAutofillMeta] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone]       = useState("");
  const [notes, setNotes]       = useState("");
  const [items, setItems]       = useState<LineItem[]>([emptyItem()]);

  useEffect(() => {
    const recommendedProductName = searchParams.get("recommendedProductName");
    if (!recommendedProductName) return;

    const recommendedProductPrice = Number(searchParams.get("recommendedProductPrice") ?? "0");
    const recommendedQuantity     = Math.max(1, parseInt(searchParams.get("recommendedQuantity") ?? "1") || 1);
    const recommendedCustomerName = searchParams.get("recommendedCustomerName") ?? "";
    const recommendedCustomerPhone = searchParams.get("recommendedCustomerPhone") ?? "";

    const timer = window.setTimeout(() => {
      setCustomerName(recommendedCustomerName);
      setPhone(recommendedCustomerPhone);
      setNotes("Upsell order prefilled from AI recommendation.");
      setItems([
        {
          product_name: recommendedProductName,
          quantity: recommendedQuantity,
          price: Number.isFinite(recommendedProductPrice) ? recommendedProductPrice : 0,
        },
      ]);
      setChatText("");
      setAutofillMeta("Prefilled from AI product recommendation.");
      setError(null);
      setStep("form");
      setOpen(true);
    }, 0);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("recommendedProductId");
    params.delete("recommendedProductName");
    params.delete("recommendedProductPrice");
    params.delete("recommendedQuantity");
    params.delete("recommendedCustomerName");
    params.delete("recommendedCustomerPhone");
    params.delete("recommendationSource");

    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(nextUrl, { scroll: false });

    return () => window.clearTimeout(timer);
  }, [pathname, router, searchParams]);

  function openModal() {
    setCustomerName(""); setPhone(""); setNotes("");
    setItems([emptyItem()]); setError(null); setStep("form");
    setChatText(""); setAutofillMeta(null); setOpen(true);
  }

  async function handleAutofill() {
    if (!chatText.trim()) {
      setError("Paste a customer chat first to use AI autofill.");
      return;
    }

    setAutofillLoading(true);
    setError(null);
    setAutofillMeta(null);

    const result = await autofillManualOrderFromChat(chatText);
    setAutofillLoading(false);

    if (result.error || !result.data) {
      setError(result.error ?? "AI autofill could not parse this chat.");
      return;
    }

    if (result.data.customerName) setCustomerName(result.data.customerName);
    if (result.data.phone) setPhone(result.data.phone);
    if (result.data.notes) setNotes(result.data.notes);
    if (result.data.items.length > 0) setItems(result.data.items);
    setAutofillMeta(`Autofilled with ${(result.data.confidence * 100).toFixed(0)}% confidence.`);
  }

  function updateItem(idx: number, field: keyof LineItem, value: string) {
    setItems((prev) => prev.map((it, i) => {
      if (i !== idx) return it;
      if (field === "quantity") return { ...it, quantity: Math.max(1, parseInt(value) || 1) };
      if (field === "price")    return { ...it, price: Math.max(0, parseFloat(value) || 0) };
      return { ...it, [field]: value };
    }));
  }

  function addItem()              { setItems((p) => [...p, emptyItem()]); }
  function removeItem(idx: number){ setItems((p) => p.filter((_, i) => i !== idx)); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerName.trim())  { setError("Customer name is required."); return; }
    if (!phone.trim())          { setError("Phone number is required.");  return; }
    if (items.some((i) => !i.product_name.trim())) {
      setError("All items need a product name."); return;
    }

    setLoading(true); setError(null);

    const input: ManualOrderInput = {
      customerName,
      phone,
      items,
      notes: notes.trim() || undefined,
    };

    const result = await createManualOrder(input);
    setLoading(false);

    if (result.error) { setError(result.error); return; }
    setStep("success");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={openModal}
        className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        + New Order
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-800">
                {step === "success" ? "Order Created" : "New Manual Order"}
              </h2>
              <button onClick={() => setOpen(false)} aria-label="Close"
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            {step === "success" ? (
              <div className="flex flex-col items-center py-4 gap-4">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gray-800">Order placed!</p>
                  <p className="text-sm text-gray-500 mt-1">Added {items.length} item{items.length > 1 ? "s" : ""} for <span className="font-medium text-gray-700">{customerName}</span>.</p>
                </div>
                <div className="flex gap-3 w-full mt-2">
                  <button onClick={openModal} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors">Add Another</button>
                  <button onClick={() => setOpen(false)} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 rounded-lg transition-colors">Done</button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4" noValidate>
                {/* AI Autofill */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                      Chat-to-Order Autofill
                    </p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-white">
                      PRO AI
                    </span>
                  </div>
                  <textarea
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    rows={3}
                    placeholder="Paste customer WhatsApp chat here and autofill the order fields"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
                  />
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    {canUseAiAutofill ? (
                      <button
                        type="button"
                        onClick={handleAutofill}
                        disabled={autofillLoading || !chatText.trim()}
                        className="text-xs font-semibold bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-black disabled:opacity-50 transition-colors"
                      >
                        {autofillLoading ? "Autofilling..." : "Autofill with AI"}
                      </button>
                    ) : (
                      <Link
                        href="/dashboard/billing?feature=ai-inbox-copilot"
                        className="text-xs font-semibold bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg hover:bg-amber-200 transition-colors"
                      >
                        Upgrade to Pro to use AI autofill
                      </Link>
                    )}
                    {autofillMeta && <p className="text-xs text-green-700 font-medium">{autofillMeta}</p>}
                  </div>
                </div>

                {/* Customer */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Customer Name <span className="text-red-400">*</span></label>
                    <input value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Amara Okonkwo" autoComplete="off"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Phone <span className="text-red-400">*</span></label>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)}
                      type="tel" placeholder="+2348012345678" autoComplete="off"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                </div>

                {/* Items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-600">Order Items <span className="text-red-400">*</span></label>
                    <button type="button" onClick={addItem}
                      className="text-xs text-green-600 font-medium hover:underline">+ Add item</button>
                  </div>
                  <div className="space-y-2">
                    {items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                        <input value={item.product_name}
                          onChange={(e) => updateItem(idx, "product_name", e.target.value)}
                          placeholder="Product name" autoComplete="off"
                          className="col-span-12 sm:col-span-6 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                        <input value={item.quantity} type="number" min="1"
                          onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                          className="col-span-4 sm:col-span-2 border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500" />
                        <input value={item.price === 0 ? "" : item.price} type="number" min="0" step="0.01"
                          onChange={(e) => updateItem(idx, "price", e.target.value)}
                          placeholder="Price"
                          className="col-span-8 sm:col-span-3 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(idx)}
                            className="col-span-12 sm:col-span-1 text-gray-400 hover:text-red-500 h-10 sm:h-auto text-lg leading-none">&times;</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Qty  Unit price (). Price 0 = price TBD.</p>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                    placeholder="Delivery address, special instructions"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                </div>

                {error && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setOpen(false)}
                    className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                  <button type="submit" disabled={loading}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                    {loading ? "Creating" : "Create Order"}
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
