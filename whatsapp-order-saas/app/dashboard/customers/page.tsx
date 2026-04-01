import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import AddCustomerModal from "@/components/AddCustomerModal";
import DownloadCustomersButton from "@/components/DownloadCustomersButton";
import { OfflineCustomersPanel } from "@/components/OfflineCustomersPanel";
import EditCustomerModal from "@/components/EditCustomerModal";

// Matches the columns that exist in the Supabase customers table
interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  created_at: string;
}

export default async function CustomersPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, name, phone, created_at")
    .eq("vendor_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[CustomersPage] fetch error:", error);
  }

  const rows: CustomerRow[] = customers ?? [];

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Customers</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {rows.length === 0
              ? "No customers yet"
              : `${rows.length} customer${rows.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex gap-2 mt-4">
          <AddCustomerModal vendorId={user.id} />
          <DownloadCustomersButton customers={rows} />
        </div>
      </div>
      <div className="mt-6">
        {rows.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700">No customers yet</p>
            <p className="text-xs text-gray-400 mt-1">Click &ldquo;+ Add Customer&rdquo; to add your first one.</p>
          </div>
        ) : (
          <table className="min-w-full bg-white rounded-xl border border-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Name</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Phone</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Added</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((customer) => (
                <tr key={customer.id}>
                  <td className="px-4 py-2 text-sm text-gray-800 flex items-center">
                    {customer.name}
                    <EditCustomerModal customer={customer} />
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-800">{customer.phone}</td>
                  <td className="px-4 py-2 text-sm text-gray-500">{new Date(customer.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <OfflineCustomersPanel />
    </div>
  );
}

