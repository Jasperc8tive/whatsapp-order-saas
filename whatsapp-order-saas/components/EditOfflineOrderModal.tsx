
"use client";
import { useState } from "react";
import { offlineDB } from "@/lib/utils";

export function EditOfflineOrderModal({ order, onClose, onSave }: { order: any, onClose: () => void, onSave: (order: any) => void }) {
  const [customerName, setCustomerName] = useState(order.customerName || "");
  const [phone, setPhone] = useState(order.phone || "");
  const [notes, setNotes] = useState(order.notes || "");
  const [items, setItems] = useState(order.items || []);
  const [error, setError] = useState<string | null>(null);

  function updateItem(idx: number, field: string, value: string) {
    setItems((prev: any[]) => prev.map((it, i) => {
      if (i !== idx) return it;
      if (field === "quantity") return { ...it, quantity: Math.max(1, parseInt(value) || 1) };
      if (field === "price") return { ...it, price: Math.max(0, parseFloat(value) || 0) };
      return { ...it, [field]: value };
    }));
  }

  function addItem() { setItems((p: any[]) => [...p, { product_name: "", quantity: 1, price: 0 }]); }
  function removeItem(idx: number) { setItems((p: any[]) => p.filter((_, i) => i !== idx)); }

  async function handleSave(e: any) {
    e.preventDefault();
    if (!customerName.trim()) { setError("Customer name is required."); return; }
    if (!phone.trim()) { setError("Phone number is required."); return; }
    if (items.some((i: any) => !i.product_name.trim())) { setError("All items need a product name."); return; }
    const updated = { ...order, customerName, phone, notes, items };
    await offlineDB.saveOrder(updated);
    onSave(updated);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={handleSave} className="bg-white rounded-xl shadow-xl w-full max-w-lg p-4 sm:p-6 max-h-[90vh] overflow-y-auto space-y-4">
        <h2 className="text-base font-semibold text-gray-800 mb-2">Edit Offline Order</h2>
        {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
        <div className="space-y-2">
          <input className="w-full border rounded p-2" placeholder="Customer Name" value={customerName} onChange={e => setCustomerName(e.target.value)} />
          <input className="w-full border rounded p-2" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
          <textarea className="w-full border rounded p-2" placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div className="space-y-2">
          <div className="font-medium">Items</div>
          {items.map((item: any, idx: number) => (
            <div key={idx} className="flex gap-2 items-center">
              <input className="border rounded p-1 flex-1" placeholder="Product Name" value={item.product_name} onChange={e => updateItem(idx, "product_name", e.target.value)} />
              <input className="border rounded p-1 w-16" type="number" min="1" placeholder="Qty" value={item.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)} />
              <input className="border rounded p-1 w-20" type="number" min="0" placeholder="Price" value={item.price} onChange={e => updateItem(idx, "price", e.target.value)} />
              <button type="button" className="text-red-600 text-xs" onClick={() => removeItem(idx)}>Remove</button>
            </div>
          ))}
          <button type="button" className="text-blue-600 text-xs mt-1" onClick={addItem}>+ Add Item</button>
        </div>
        <div className="flex gap-2 mt-4">
          <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">Save</button>
          <button type="button" className="bg-gray-200 px-4 py-2 rounded" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
