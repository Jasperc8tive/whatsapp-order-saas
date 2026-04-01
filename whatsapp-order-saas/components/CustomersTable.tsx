"use client";

import { useState } from "react";
import BulkActionsBar from "@/components/BulkActionsBar";
import EditCustomerModal from "@/components/EditCustomerModal";
import DeleteCustomerButton from "@/components/DeleteCustomerButton";

export default function CustomersTable({ customers }) {
  const [selected, setSelected] = useState([]);

  function toggle(id) {
    setSelected((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleAll() {
    if (selected.length === customers.length) setSelected([]);
    else setSelected(customers.map(c => c.id));
  }
  function clearSelection() {
    setSelected([]);
  }

  return (
    <>
      {selected.length > 0 && (
        <BulkActionsBar selectedIds={selected} onClear={clearSelection} customers={customers} />
      )}
      <table className="min-w-full bg-white rounded-xl border border-gray-200">
        <thead>
          <tr>
            <th className="px-2">
              <input
                type="checkbox"
                checked={selected.length === customers.length && customers.length > 0}
                onChange={toggleAll}
                aria-label="Select all"
              />
            </th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Name</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Phone</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Added</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <tr key={customer.id}>
              <td className="px-2">
                <input
                  type="checkbox"
                  checked={selected.includes(customer.id)}
                  onChange={() => toggle(customer.id)}
                  aria-label={`Select ${customer.name}`}
                />
              </td>
              <td className="px-4 py-2 text-sm text-gray-800 flex items-center">
                {customer.name}
                <EditCustomerModal customer={customer} />
                <DeleteCustomerButton customerId={customer.id} />
              </td>
              <td className="px-4 py-2 text-sm text-gray-800">{customer.phone}</td>
              <td className="px-4 py-2 text-sm text-gray-500">{new Date(customer.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
