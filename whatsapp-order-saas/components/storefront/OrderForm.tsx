"use client";

import { useState, useTransition } from "react";
import { submitOrder, type OrderLineItem, type SubmitOrderResult } from "@/lib/actions/storefront";

// ── WhatsApp icon (reused) ────────────────────────────────────────────────────
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

interface OrderFormProps {
  vendorSlug: string;
  vendorName: string;
  vendorPhone?: string | null;
  products?: Array<{
    id: string;
    name: string;
    description?: string | null;
    price: number;
    image_url?: string | null;
  }>;
}

const emptyItem = (): OrderLineItem => ({ product_name: "", quantity: 1 });

// ── Confirmation screen ───────────────────────────────────────────────────────
function OrderConfirmation({
  result,
  vendorPhone,
  onNewOrder,
}: {
  result: SubmitOrderResult;
  vendorPhone?: string | null;
  onNewOrder: () => void;
}) {
  const waMessage = encodeURIComponent(
    `Hi! I just placed an order (Ref: #${result.orderRef}). Please confirm my order. Thank you!`
  );
  const waLink = vendorPhone
    ? `https://wa.me/${vendorPhone.replace(/\D/g, "")}?text=${waMessage}`
    : null;

  return (
    <div className="text-center py-4 space-y-5">
      {/* Success icon */}
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-900">Order placed!</h2>
        <p className="text-sm text-gray-500 mt-1">
          Your order has been received by{" "}
          <span className="font-semibold text-gray-700">{result.vendorName}</span>
        </p>
      </div>

      {/* Order reference */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
          Order reference
        </p>
        <p className="text-2xl font-mono font-bold text-gray-900 tracking-widest">
          #{result.orderRef}
        </p>
        <p className="text-xs text-gray-400 mt-1">Save this for tracking your order</p>
      </div>

      {/* WhatsApp follow-up */}
      {waLink ? (
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          <WhatsAppIcon className="w-5 h-5" />
          Chat with {result.vendorName} on WhatsApp
        </a>
      ) : (
        <div className="flex items-center gap-2 justify-center text-sm text-green-700 bg-green-50 rounded-xl py-3 px-4">
          <WhatsAppIcon className="w-4 h-4" />
          The vendor will contact you on WhatsApp to confirm your order.
        </div>
      )}

      <button
        onClick={onNewOrder}
        className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors"
      >
        Place another order →
      </button>
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────
export default function OrderForm({ vendorSlug, vendorName, vendorPhone, products }: OrderFormProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmation, setConfirmation] = useState<SubmitOrderResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Customer fields
  const [name, setName]       = useState("");
  const [phone, setPhone]     = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes]     = useState("");

  // Dynamic line items
  const [items, setItems] = useState<OrderLineItem[]>([emptyItem()]);

  const updateItem = (index: number, field: keyof OrderLineItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const removeItem = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await submitOrder({
        vendor_slug: vendorSlug,
        customer_name: name,
        phone,
        address,
        items,
        notes,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setConfirmation(result);
      }
    });
  };

  const resetForm = () => {
    setConfirmation(null);
    setError(null);
    setName("");
    setPhone("");
    setAddress("");
    setNotes("");
    setItems([emptyItem()]);
  };

  // ── Confirmation screen ──────────────────────────────────────────────────
  if (confirmation) {
    return (
      <OrderConfirmation
        result={confirmation}
        vendorPhone={vendorPhone}
        onNewOrder={resetForm}
      />
    );
  }

  // ── Order form ───────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* ── Section: Your details ── */}
      <fieldset>
        <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Your details
        </legend>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Amara Okonkwo"
              className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              WhatsApp phone <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2">
                <WhatsAppIcon className="w-4 h-4 text-green-500" />
              </span>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+234 800 000 0000"
                className="w-full border border-gray-300 rounded-xl pl-9 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delivery address <span className="text-red-400">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="10 Banana Island Road, Lagos"
              className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
            />
          </div>
        </div>
      </fieldset>

      {/* ── Section: Product catalogue (if vendor has products set up) ── */}
      {products && products.length > 0 && (
        <fieldset>
          <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Menu / Catalogue
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {products.map((p) => {
              const existingIdx = items.findIndex((i) => i.product_name === p.name);
              const qty = existingIdx >= 0 ? items[existingIdx].quantity : 0;

              function increment() {
                if (existingIdx >= 0) {
                  updateItem(existingIdx, "quantity", qty + 1);
                } else {
                  setItems((prev) => [...prev.filter((i) => i.product_name !== ""), { product_name: p.name, quantity: 1 }]);
                }
              }
              function decrement() {
                if (existingIdx < 0) return;
                if (qty <= 1) {
                  setItems((prev) => prev.filter((_, i) => i !== existingIdx));
                } else {
                  updateItem(existingIdx, "quantity", qty - 1);
                }
              }

              return (
                <div key={p.id} className="flex gap-3 bg-gray-50 rounded-xl border border-gray-200 p-3 items-center">
                  {p.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                    {p.description && <p className="text-xs text-gray-500 truncate">{p.description}</p>}
                    <p className="text-sm font-bold text-green-700 mt-0.5">
                      {p.price > 0 ? `₦${p.price.toLocaleString("en-NG")}` : "Price on request"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {qty > 0 ? (
                      <>
                        <button type="button" onClick={decrement}
                          className="w-7 h-7 rounded-full border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm font-bold leading-none">−</button>
                        <span className="w-5 text-center text-sm font-semibold text-gray-800">{qty}</span>
                        <button type="button" onClick={increment}
                          className="w-7 h-7 rounded-full bg-green-600 text-white hover:bg-green-700 flex items-center justify-center text-sm font-bold leading-none">+</button>
                      </>
                    ) : (
                      <button type="button" onClick={increment}
                        className="px-3 py-1.5 rounded-full bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors">
                        Add
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-2">Or type a custom item below ↓</p>
        </fieldset>
      )}

      {/* ── Section: Order items ── */}
      <fieldset>
        <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          What would you like?
        </legend>

        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={index}
              className="flex items-start gap-2 bg-gray-50 rounded-xl border border-gray-200 p-3"
            >
              {/* Product name */}
              <div className="flex-1">
                <input
                  type="text"
                  required
                  value={item.product_name}
                  onChange={(e) => updateItem(index, "product_name", e.target.value)}
                  placeholder={`e.g. Jollof Rice Pack`}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Quantity */}
              <div className="flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden flex-shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    updateItem(index, "quantity", Math.max(1, item.quantity - 1))
                  }
                  className="px-2.5 py-2 text-gray-500 hover:bg-gray-100 transition-colors font-bold text-base leading-none"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  required
                  value={item.quantity}
                  onChange={(e) =>
                    updateItem(index, "quantity", Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className="w-10 text-center text-sm font-semibold py-2 focus:outline-none bg-transparent"
                />
                <button
                  type="button"
                  onClick={() => updateItem(index, "quantity", item.quantity + 1)}
                  className="px-2.5 py-2 text-gray-500 hover:bg-gray-100 transition-colors font-bold text-base leading-none"
                >
                  +
                </button>
              </div>

              {/* Remove item (only show when >1 item) */}
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="p-2 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                  aria-label="Remove item"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add item button */}
        <button
          type="button"
          onClick={addItem}
          className="mt-2 flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700 font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add another item
        </button>
      </fieldset>

      {/* ── Notes ── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Additional notes
          <span className="text-gray-400 font-normal"> (optional)</span>
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Special instructions, preferred delivery time, etc."
          className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
        />
      </div>

      {/* ── Submit ── */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2.5"
      >
        {isPending ? (
          <>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Placing order…
          </>
        ) : (
          <>
            <WhatsAppIcon className="w-5 h-5" />
            Place order with {vendorName}
          </>
        )}
      </button>

      <p className="text-center text-xs text-gray-400">
        By placing an order you agree to be contacted via WhatsApp for order confirmation.
      </p>
    </form>
  );
}
