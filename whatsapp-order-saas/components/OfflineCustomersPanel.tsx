
"use client";
import { useOfflineCustomers } from "@/lib/useOfflineCustomers";
import { offlineDB } from "@/lib/utils";
import { useState } from "react";

export function OfflineCustomersPanel() {
  const customers = useOfflineCustomers();
  const [editing, setEditing] = useState<any|null>(null);

  async function deleteCustomer(id: string) {
    const all = await offlineDB.getCustomers();
    await offlineDB.clearCustomers();
    for (const c of all) {
      if (c.id !== id) await offlineDB.saveCustomer(c);
    }
    window.dispatchEvent(new Event("offline-customer-changed"));
  }

  function handleEdit(customer: any) {
    setEditing(customer);
  }

  function handleEditSave(updated: any) {
    setEditing(null);
    window.dispatchEvent(new Event("offline-customer-changed"));
  }

  if (!customers.length) return null;
  return (
    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="font-semibold text-blue-800 mb-2">Unsynced Customers ({customers.length})</div>
      <ul className="space-y-2">
        {customers.map((customer) => (
          <li key={customer.id} className="flex items-center justify-between bg-white rounded p-2 border border-blue-100">
            <div>
              <div className="font-medium text-gray-800">{customer.name}</div>
              <div className="text-xs text-gray-500">{customer.phone}</div>
            </div>
            <div className="flex gap-2">
              <button className="text-blue-600 hover:underline text-xs" onClick={() => handleEdit(customer)}>Edit</button>
              <button className="text-red-600 hover:underline text-xs" onClick={() => deleteCustomer(customer.id)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
      {editing && (
        <EditOfflineCustomerModal customer={editing} onClose={() => setEditing(null)} onSave={handleEditSave} />
      )}
    </div>
  );
}

function EditOfflineCustomerModal({ customer, onClose, onSave }: { customer: any, onClose: () => void, onSave: (customer: any) => void }) {
  const [name, setName] = useState(customer.name || "");
  const [phone, setPhone] = useState(customer.phone || "");
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: any) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required."); return; }
    if (!phone.trim()) { setError("Phone is required."); return; }
    const updated = { ...customer, name, phone };
    await offlineDB.saveCustomer(updated);
    onSave(updated);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={handleSave} className="bg-white rounded-xl shadow-xl w-full max-w-md p-4 space-y-4">
        <h2 className="text-base font-semibold text-gray-800 mb-2">Edit Offline Customer</h2>
        {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
        <input className="w-full border rounded p-2" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
        <input className="w-full border rounded p-2" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
        <div className="flex gap-2 mt-4">
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Save</button>
          <button type="button" className="bg-gray-200 px-4 py-2 rounded" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
