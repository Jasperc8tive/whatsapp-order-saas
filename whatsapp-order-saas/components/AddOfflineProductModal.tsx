import { useState } from "react";
import { offlineDB } from "@/lib/utils";

export function AddOfflineProductModal({ open, onClose }: { open: boolean, onClose: () => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave(e: any) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required."); return; }
    if (!price || isNaN(price)) { setError("Price is required."); return; }
    const product = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2),
      name,
      price,
      offline: true,
      createdAt: new Date().toISOString(),
    };
    await offlineDB.saveProduct(product);
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setName("");
      setPrice(0);
      onClose();
    }, 1000);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={handleSave} className="bg-white rounded-xl shadow-xl w-full max-w-md p-4 space-y-4">
        <h2 className="text-base font-semibold text-gray-800 mb-2">Add Offline Product</h2>
        {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
        {success && <div className="text-green-600 text-sm mb-2">Product saved offline!</div>}
        <input className="w-full border rounded p-2" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
        <input className="w-full border rounded p-2" type="number" min="0" placeholder="Price" value={price} onChange={e => setPrice(Number(e.target.value))} />
        <div className="flex gap-2 mt-4">
          <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded">Save</button>
          <button type="button" className="bg-gray-200 px-4 py-2 rounded" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
