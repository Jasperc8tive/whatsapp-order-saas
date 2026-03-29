import { useOfflineProducts } from "@/lib/useOfflineProducts";
import { offlineDB } from "@/lib/utils";
import { useState } from "react";

export function OfflineProductsPanel() {
  const products = useOfflineProducts();
  const [editing, setEditing] = useState<any|null>(null);

  async function deleteProduct(id: string) {
    const all = await offlineDB.getProducts();
    await offlineDB.clearProducts();
    for (const p of all) {
      if (p.id !== id) await offlineDB.saveProduct(p);
    }
    window.dispatchEvent(new Event("offline-product-changed"));
  }

  function handleEdit(product: any) {
    setEditing(product);
  }

  function handleEditSave(updated: any) {
    setEditing(null);
    window.dispatchEvent(new Event("offline-product-changed"));
  }

  if (!products.length) return null;
  return (
    <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
      <div className="font-semibold text-purple-800 mb-2">Unsynced Products ({products.length})</div>
      <ul className="space-y-2">
        {products.map((product) => (
          <li key={product.id} className="flex items-center justify-between bg-white rounded p-2 border border-purple-100">
            <div>
              <div className="font-medium text-gray-800">{product.name}</div>
              <div className="text-xs text-gray-500">₦{product.price}</div>
            </div>
            <div className="flex gap-2">
              <button className="text-purple-600 hover:underline text-xs" onClick={() => handleEdit(product)}>Edit</button>
              <button className="text-red-600 hover:underline text-xs" onClick={() => deleteProduct(product.id)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
      {editing && (
        <EditOfflineProductModal product={editing} onClose={() => setEditing(null)} onSave={handleEditSave} />
      )}
    </div>
  );
}

function EditOfflineProductModal({ product, onClose, onSave }: { product: any, onClose: () => void, onSave: (product: any) => void }) {
  const [name, setName] = useState(product.name || "");
  const [price, setPrice] = useState(product.price || 0);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: any) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required."); return; }
    if (!price || isNaN(price)) { setError("Price is required."); return; }
    const updated = { ...product, name, price };
    await offlineDB.saveProduct(updated);
    onSave(updated);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={handleSave} className="bg-white rounded-xl shadow-xl w-full max-w-md p-4 space-y-4">
        <h2 className="text-base font-semibold text-gray-800 mb-2">Edit Offline Product</h2>
        {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
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
