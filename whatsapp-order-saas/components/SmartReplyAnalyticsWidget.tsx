import { SmartReplyAnalytics } from "@/lib/analytics";

interface SmartReplyAnalyticsWidgetProps {
  analytics: SmartReplyAnalytics;
}

export function SmartReplyAnalyticsWidget({
  analytics,
}: SmartReplyAnalyticsWidgetProps) {
  const copyPercentage = Math.round(analytics.copyRate * 100);
  const whatsappPercentage = Math.round(analytics.whatsappRate * 100);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="font-semibold text-gray-900">Smart Reply Analytics</h3>
            <p className="text-sm text-gray-500">Last 7 days</p>
          </div>
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 rounded-full">
            <span className="text-xs font-semibold text-purple-700">Pro</span>
          </div>
        </div>

        {/* Key metrics grid */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <div className="text-sm text-gray-600">Generated</div>
            <div className="text-2xl font-bold text-gray-900">
              {analytics.totalGenerated}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Copy Rate</div>
            <div className="text-2xl font-bold text-blue-600">
              {copyPercentage}%
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">WhatsApp Rate</div>
            <div className="text-2xl font-bold text-green-600">
              {whatsappPercentage}%
            </div>
          </div>
        </div>

        {/* Breakdown by surface */}
        {analytics.bySurface.length > 0 && (
          <div className="mb-6 pb-6 border-t border-gray-200">
            <h4 className="font-medium text-gray-900 mb-3 text-sm">
              By Surface
            </h4>
            <div className="space-y-2">
              {analytics.bySurface.map((surface) => (
                <div
                  key={surface.surface}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-gray-600">
                    {surface.surface === "kanban_card"
                      ? "Order Board"
                      : "Order Details"}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="font-medium text-gray-900">
                      {surface.generated} generated
                    </span>
                    <span className="text-gray-500">
                      {surface.copied} copied
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity by day */}
        {analytics.byDay.length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <h4 className="font-medium text-gray-900 mb-3 text-sm">
              Activity by Day
            </h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {analytics.byDay.map((day) => (
                <div
                  key={day.day}
                  className="flex items-center justify-between text-xs text-gray-600"
                >
                  <span>{new Date(day.day).toLocaleDateString()}</span>
                  <span>
                    {day.generated} generated, {day.copied} copied,{" "}
                    {day.whatsappClicked} clicked
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {analytics.totalGenerated === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">
              No Smart Reply activity in the last 7 days
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
