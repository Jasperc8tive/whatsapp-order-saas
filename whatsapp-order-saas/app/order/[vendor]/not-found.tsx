import Link from "next/link";

export default function VendorNotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Store not found</h1>
        <p className="text-sm text-gray-500 mb-6">
          This store link is invalid or the vendor has not set up their storefront yet.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-green-600 font-medium hover:underline"
        >
          ← Back to WhatsOrder
        </Link>
      </div>
    </div>
  );
}
