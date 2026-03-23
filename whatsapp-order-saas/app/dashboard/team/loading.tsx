export default function TeamLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-10 animate-pulse">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-7 w-24 bg-gray-200 rounded" />
        <div className="h-4 w-64 bg-gray-100 rounded" />
      </div>

      {/* Invite card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
        <div className="flex gap-3">
          <div className="flex-1 h-9 bg-gray-100 rounded-lg" />
          <div className="w-36 h-9 bg-gray-100 rounded-lg" />
          <div className="w-24 h-9 bg-gray-200 rounded-lg" />
        </div>
      </div>

      {/* Members list */}
      <div>
        <div className="h-5 w-28 bg-gray-200 rounded mb-3" />
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-4 gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-40 bg-gray-200 rounded" />
                <div className="h-3 w-28 bg-gray-100 rounded" />
              </div>
              <div className="flex gap-2">
                <div className="h-5 w-16 bg-gray-100 rounded-full" />
                <div className="h-5 w-14 bg-gray-100 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
