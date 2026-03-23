export default function BillingLoading() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="mb-6 space-y-2">
        <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />
      </div>

      {/* Usage bar skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="h-2 w-full bg-gray-100 rounded-full animate-pulse" />
      </div>

      {/* Plan cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-4">
            <div className="space-y-1.5">
              <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-3.5 w-48 bg-gray-100 rounded animate-pulse" />
            </div>
            <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
                  <div className="h-3.5 w-40 bg-gray-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
            <div className="h-9 w-full bg-gray-200 rounded-lg animate-pulse mt-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
