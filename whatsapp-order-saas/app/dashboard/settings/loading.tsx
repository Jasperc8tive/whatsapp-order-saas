export default function SettingsLoading() {
  return (
    <div className="max-w-xl space-y-6">
      {/* Header skeleton */}
      <div className="space-y-1.5">
        <div className="h-5 w-36 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />
      </div>

      {/* Form card skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {/* Business name */}
        <div className="space-y-1.5">
          <div className="h-3.5 w-28 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-full bg-gray-100 rounded-lg animate-pulse" />
        </div>
        {/* Slug */}
        <div className="space-y-1.5">
          <div className="h-3.5 w-20 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-full bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-gray-50 rounded animate-pulse" />
        </div>
        {/* WhatsApp */}
        <div className="space-y-1.5">
          <div className="h-3.5 w-36 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-full bg-gray-100 rounded-lg animate-pulse" />
        </div>
        {/* Save button */}
        <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
