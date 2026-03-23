export default function OrdersLoading() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="h-5 w-28 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="h-9 w-32 bg-gray-200 rounded-xl animate-pulse" />
      </div>

      {/* Kanban columns skeleton */}
      <div className="flex gap-4 overflow-x-auto pb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex-shrink-0 w-64 bg-gray-50 rounded-2xl p-3 space-y-3"
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-1">
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
              <div className="h-5 w-6 bg-gray-200 rounded-full animate-pulse" />
            </div>

            {/* Cards */}
            {Array.from({ length: i === 0 ? 3 : i === 1 ? 2 : 1 }).map((_, j) => (
              <div
                key={j}
                className="bg-white rounded-xl p-3 shadow-sm space-y-2 border border-gray-100"
              >
                <div className="flex items-start justify-between">
                  <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 w-14 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="h-3 w-32 bg-gray-100 rounded animate-pulse" />
                <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
