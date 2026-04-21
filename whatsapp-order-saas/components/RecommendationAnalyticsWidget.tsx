import { RecommendationAnalytics } from "@/lib/analytics";

interface RecommendationAnalyticsWidgetProps {
  analytics: RecommendationAnalytics;
}

export function RecommendationAnalyticsWidget({
  analytics,
}: RecommendationAnalyticsWidgetProps) {
  const acceptPct       = Math.round(analytics.acceptRate       * 100);
  const catalogClickPct = Math.round(analytics.catalogClickRate * 100);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="font-semibold text-gray-900">Recommendation Analytics</h3>
            <p className="text-sm text-gray-500">Last 7 days</p>
          </div>
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 rounded-full">
            <span className="text-xs font-semibold text-purple-700">Pro</span>
          </div>
        </div>

        {/* Key metrics grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div>
            <div className="text-sm text-gray-600">Impressions</div>
            <div className="text-2xl font-bold text-gray-900">
              {analytics.totalImpressions}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Accepts</div>
            <div className="text-2xl font-bold text-green-600">
              {analytics.totalAccepts}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Catalog Clicks</div>
            <div className="text-2xl font-bold text-blue-600">
              {analytics.totalCatalogClicks}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Accept Rate</div>
            <div className="text-2xl font-bold text-purple-600">
              {acceptPct}%
            </div>
          </div>
        </div>

        {/* Funnel bars */}
        {analytics.totalImpressions > 0 && (
          <div className="mb-6 pb-6 border-t border-gray-200 pt-4">
            <h4 className="font-medium text-gray-900 mb-3 text-sm">Funnel</h4>
            <div className="space-y-3">
              {/* Impressions bar — always 100% baseline */}
              <div>
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>Impressions</span>
                  <span className="font-medium text-gray-900">{analytics.totalImpressions}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200">
                  <div className="h-2 rounded-full bg-gray-400" style={{ width: "100%" }} />
                </div>
              </div>

              {/* Accepts bar */}
              <div>
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>Added to Order</span>
                  <span className="font-medium text-green-700">
                    {analytics.totalAccepts} ({acceptPct}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-green-500 transition-all"
                    style={{ width: `${acceptPct}%` }}
                  />
                </div>
              </div>

              {/* Catalog clicks bar */}
              <div>
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>Viewed in Catalog</span>
                  <span className="font-medium text-blue-700">
                    {analytics.totalCatalogClicks} ({catalogClickPct}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-blue-500 transition-all"
                    style={{ width: `${catalogClickPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Activity by day */}
        {analytics.byDay.length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <h4 className="font-medium text-gray-900 mb-3 text-sm">Activity by Day</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {analytics.byDay.map((day) => (
                <div
                  key={day.day}
                  className="flex items-center justify-between text-xs text-gray-600"
                >
                  <span>{new Date(day.day).toLocaleDateString()}</span>
                  <span>
                    {day.impressions} shown · {day.accepts} added · {day.catalogClicks} viewed
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {analytics.totalImpressions === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">
              No recommendation activity in the last 7 days.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Open an order and click &quot;Get Recommendations&quot; to start tracking.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
