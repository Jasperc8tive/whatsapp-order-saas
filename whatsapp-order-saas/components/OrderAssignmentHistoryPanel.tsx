import ActivityTimeline from "@/components/ActivityTimeline";

export default function OrderAssignmentHistoryPanel({ orderId, vendorId }: { orderId: string; vendorId: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mt-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Assignment History</h3>
      <ActivityTimeline
        vendorId={vendorId}
        filters={{ entityType: "order" }}
        autoRefresh={true}
      />
    </div>
  );
}
