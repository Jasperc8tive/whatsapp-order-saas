export default function OrderDetailLoading() {
  return (
    <div className="max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <div className="h-4 w-14 bg-gray-200 rounded animate-pulse" />
        <span className="text-gray-300">/</span>
        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="h-5 w-36 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-44 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="h-9 w-40 bg-gray-100 rounded-lg animate-pulse" />
      </div>

      {/* Status badges */}
      <div className="flex gap-2">
        <div className="h-6 w-24 rounded-full bg-gray-200 animate-pulse" />
        <div className="h-6 w-28 rounded-full bg-gray-100 animate-pulse" />
      </div>

      {/* Customer card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
          <div className="space-y-1.5">
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-3.5 w-24 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Items card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div className="space-y-1.5">
                <div className="h-3.5 w-28 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
              </div>
              <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
          <div className="flex items-center justify-between pt-1">
            <div className="h-4 w-10 bg-gray-200 rounded animate-pulse" />
            <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
