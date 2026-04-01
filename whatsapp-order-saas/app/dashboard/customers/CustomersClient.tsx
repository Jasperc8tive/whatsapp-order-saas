"use client";

import AddCustomerModal from "@/components/AddCustomerModal";
import DownloadCustomersButton from "@/components/DownloadCustomersButton";
import ImportCustomersButton from "@/components/ImportCustomersButton";
import CustomersTable from "@/components/CustomersTable";
import { OfflineCustomersPanel } from "@/components/OfflineCustomersPanel";
import { CustomerRow } from "@/components/BulkActionsBar";

interface CustomersClientProps {
  customers: CustomerRow[];
  vendorId: string;
}

export default function CustomersClient({ customers, vendorId }: CustomersClientProps) {
  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Customers</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {customers.length === 0
              ? "No customers yet"
              : `${customers.length} customer${customers.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex gap-2 mt-4">
          <AddCustomerModal vendorId={vendorId} />
          <DownloadCustomersButton customers={customers} />
          <ImportCustomersButton vendorId={vendorId} onDone={() => {}} />
        </div>
      </div>
      <div className="mt-6">
        {customers.length === 0 ? (
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
          <CustomersTable customers={customers} />
        )}
      </div>
      <OfflineCustomersPanel />
    </div>
  );
}
