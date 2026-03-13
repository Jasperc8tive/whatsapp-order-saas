import { formatCurrency, formatDate } from "@/lib/utils";
import type { Customer } from "@/types/customer";

const MOCK_CUSTOMERS: Customer[] = [
  {
    id: "cust-1",
    vendor_id: "vendor-1",
    name: "Amara Okonkwo",
    phone: "+2348012345678",
    email: "amara@example.com",
    total_orders: 14,
    total_spent: 62500,
    last_order_at: new Date(Date.now() - 5 * 60000).toISOString(),
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-15T10:00:00Z",
  },
  {
    id: "cust-2",
    vendor_id: "vendor-1",
    name: "Chidi Nwosu",
    phone: "+2348098765432",
    total_orders: 8,
    total_spent: 28000,
    last_order_at: new Date(Date.now() - 12 * 60000).toISOString(),
    created_at: "2024-02-20T10:00:00Z",
    updated_at: "2024-02-20T10:00:00Z",
  },
  {
    id: "cust-3",
    vendor_id: "vendor-1",
    name: "Ngozi Eze",
    phone: "+2348055544433",
    email: "ngozi@example.com",
    total_orders: 22,
    total_spent: 98400,
    last_order_at: new Date(Date.now() - 30 * 60000).toISOString(),
    created_at: "2023-12-01T10:00:00Z",
    updated_at: "2023-12-01T10:00:00Z",
  },
];

export default function CustomersPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Customers</h2>
          <p className="text-sm text-gray-500 mt-0.5">{MOCK_CUSTOMERS.length} customers found</p>
        </div>
        <button className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Add Customer
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Orders</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Spent</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Order</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_CUSTOMERS.map((customer) => (
              <tr key={customer.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {customer.name[0]}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{customer.name}</p>
                      {customer.email && <p className="text-xs text-gray-400">{customer.email}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-gray-600">{customer.phone}</td>
                <td className="px-5 py-4 text-right font-medium text-gray-800">{customer.total_orders}</td>
                <td className="px-5 py-4 text-right font-semibold text-gray-900">{formatCurrency(customer.total_spent)}</td>
                <td className="px-5 py-4 text-gray-500">
                  {customer.last_order_at ? formatDate(customer.last_order_at) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
