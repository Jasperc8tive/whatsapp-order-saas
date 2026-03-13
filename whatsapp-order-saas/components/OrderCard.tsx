import type { Order } from "@/types/order";
import { formatCurrency, formatRelativeTime, ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from "@/lib/utils";

interface OrderCardProps {
  order: Order;
  onStatusChange?: (orderId: string, status: Order["status"]) => void;
}

export default function OrderCard({ order, onStatusChange }: OrderCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-mono text-gray-400">#{order.id.slice(0, 8).toUpperCase()}</p>
          <p className="font-semibold text-gray-800 mt-0.5">{order.customer_name}</p>
          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
            <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            {order.customer_phone}
          </p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ORDER_STATUS_COLORS[order.status]}`}>
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      {/* Items */}
      <div className="space-y-1 mb-3">
        {order.items.slice(0, 2).map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span className="text-gray-600">
              {item.quantity}× {item.product_name}
            </span>
            <span className="text-gray-700 font-medium">{formatCurrency(item.unit_price * item.quantity)}</span>
          </div>
        ))}
        {order.items.length > 2 && (
          <p className="text-xs text-gray-400">+{order.items.length - 2} more items</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <span className="text-sm font-bold text-gray-900">{formatCurrency(order.total_amount)}</span>
        <span className="text-xs text-gray-400">{formatRelativeTime(order.created_at)}</span>
      </div>

      {/* Actions */}
      {onStatusChange && order.status !== "delivered" && order.status !== "cancelled" && (
        <div className="mt-3 flex gap-2">
          {order.status === "pending" && (
            <button
              onClick={() => onStatusChange(order.id, "confirmed")}
              className="flex-1 text-xs py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-medium"
            >
              Confirm
            </button>
          )}
          {order.status === "confirmed" && (
            <button
              onClick={() => onStatusChange(order.id, "processing")}
              className="flex-1 text-xs py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors font-medium"
            >
              Process
            </button>
          )}
          {order.status === "processing" && (
            <button
              onClick={() => onStatusChange(order.id, "shipped")}
              className="flex-1 text-xs py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors font-medium"
            >
              Ship
            </button>
          )}
          {order.status === "shipped" && (
            <button
              onClick={() => onStatusChange(order.id, "delivered")}
              className="flex-1 text-xs py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors font-medium"
            >
              Delivered
            </button>
          )}
          <button
            onClick={() => onStatusChange(order.id, "cancelled")}
            className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
