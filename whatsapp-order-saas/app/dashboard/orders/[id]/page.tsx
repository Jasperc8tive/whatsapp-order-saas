import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getWorkspacePlan, hasAiInboxCopilotAccess } from "@/lib/plans";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { formatCurrency, formatDate, ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from "@/lib/utils";
import type { OrderStatus } from "@/types/order";
import OrderStatusSelect from "./OrderStatusSelect";
import OrderAssignmentPanel from "./OrderAssignmentPanel";
import OrderSmartRepliesPanel from "./OrderSmartRepliesPanel";
import { getOrderAssignment, listAssignableMembers } from "@/lib/actions/assignments";
import OrderSummaryPanel from "./OrderSummaryPanel";
import CustomerSentimentAnalyzer from "./CustomerSentimentAnalyzer";
import ProductRecommendationsPanel from "./ProductRecommendationsPanel";

interface Props {
  params: { id: string };
}

export default async function OrderDetailPage({ params }: Props) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getCurrentWorkspaceId(user.id);
  if (!workspaceId) notFound();

  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", params.id)
    .eq("vendor_id", workspaceId)
    .single();

  if (error || !order) notFound();

  const currentPlanId = await getWorkspacePlan(createAdminClient(), workspaceId);
  const canUseAiSmartReplies = hasAiInboxCopilotAccess(currentPlanId);

  const customerId = (order.customer_id as string | null) ?? null;

  const { data: customer } = customerId
    ? await supabase
        .from("customers")
        .select("id, name, phone, address, email")
        .eq("id", customerId)
        .maybeSingle()
    : { data: null as { id: string; name: string; phone: string; address: string | null; email: string | null } | null };

  const { data: itemRows } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id);

  const { data: payments } = await supabase
    .from("payments")
    .select("id, amount, status, paid_at, paystack_reference")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false });

  const { data: deliveries } = await supabase
    .from("deliveries")
    .select("id, courier, tracking_id, delivery_status, dispatched_at, delivered_at, notes")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false });

  const [assignmentResult, assignableMembersResult] = await Promise.all([
    getOrderAssignment(order.id),
    listAssignableMembers(user.id),
  ]);
  const currentAssignment = assignmentResult.assignment ?? null;
  const assignableMembers = assignableMembersResult.members ?? [];

  const items = (itemRows ?? []).map((item) => {
    const unitPrice = Number((item.price ?? item.unit_price ?? 0) as number);
    const subtotal = Number((item.subtotal ?? unitPrice * Number(item.quantity ?? 0)) as number);

    return {
      id: item.id as string,
      product_name: (item.product_name as string) ?? "Unnamed item",
      quantity: Number(item.quantity ?? 0),
      price: unitPrice,
      subtotal,
    };
  });

  const paymentRows = (payments ?? []) as Array<{ id: string; amount: number; status: string; paid_at: string | null; paystack_reference: string | null }>;
  const deliveryRows = (deliveries ?? []) as Array<{ id: string; courier: string | null; tracking_id: string | null; delivery_status: string; dispatched_at: string | null; delivered_at: string | null; notes: string | null }>;
  const currentStatus = ((order.order_status ?? order.status) as OrderStatus) ?? "pending";
  const paymentStatus = ((order.payment_status ?? order.payment_status_code ?? "unpaid") as string);
  const orderTotal = Number((order.total_amount ?? order.total ?? 0) as number);

  const orderRef = order.id.slice(0, 8).toUpperCase();

  return (
    <div className="max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/dashboard/orders" className="hover:text-gray-800 transition-colors">Orders</Link>
        <span>/</span>
        <span className="font-mono font-semibold text-gray-800">#{orderRef}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Order #{orderRef}</h2>
          <p className="text-sm text-gray-500 mt-0.5">Placed {formatDate(order.created_at as string)}</p>
        </div>
        <OrderStatusSelect orderId={order.id} currentStatus={currentStatus} />
      </div>

      {/* Status badges */}
      <div className="flex gap-3 flex-wrap">
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${ORDER_STATUS_COLORS[currentStatus]}`}>
          {ORDER_STATUS_LABELS[currentStatus]}
        </span>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
          paymentStatus === "paid" ? "bg-emerald-100 text-emerald-800" :
          paymentStatus === "pending" ? "bg-yellow-100 text-yellow-800" :
          "bg-gray-100 text-gray-600"
        }`}>
          Payment: {paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}
        </span>
      </div>

      {/* Customer */}
      {customer && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Customer</h3>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
              {customer.name[0]}
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-gray-800">{customer.name}</p>
              <p className="text-sm text-gray-500">{customer.phone}</p>
                            {order.notes && (
                              <div className="pt-2 mt-2 border-t border-gray-200">
                                <p className="text-xs text-gray-500 mb-2 font-medium">Customer Message:</p>
                                <p className="text-sm text-gray-700 mb-3 italic">{order.notes}</p>
                                <CustomerSentimentAnalyzer
                                  customerMessage={order.notes as string}
                                  canUseAiFeatures={canUseAiSmartReplies}
                                />
                              </div>
                            )}
              {customer.email && <p className="text-sm text-gray-500">{customer.email}</p>}
              {customer.address && <p className="text-sm text-gray-500">{customer.address}</p>}
            </div>
          </div>
        </div>
      )}
  {/* Order Summary */}
  <OrderSummaryPanel orderId={order.id} canUseAiSummary={canUseAiSmartReplies} />


      {/* Order items */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Items</h3>
        {items.length === 0 ? (
          <p className="text-sm text-gray-400">No items recorded.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.product_name}</p>
                  <p className="text-xs text-gray-500">
                    {item.quantity} × {formatCurrency(item.price)}
                  </p>
                </div>
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(item.subtotal)}</p>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm font-semibold text-gray-700">Total</p>
              <p className="text-base font-bold text-gray-900">{formatCurrency(orderTotal)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Payments */}
      {paymentRows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Payment History</h3>
          <div className="space-y-2">
            {paymentRows.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className={`font-medium ${p.status === "paid" ? "text-green-700" : "text-yellow-700"}`}>
                    {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                  </span>
                  {p.paystack_reference && (
                    <span className="text-xs text-gray-400 ml-2 font-mono">ref: {p.paystack_reference}</span>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{formatCurrency(p.amount)}</p>
                  {p.paid_at && <p className="text-xs text-gray-400">{formatDate(p.paid_at)}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delivery */}
      {deliveryRows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Delivery</h3>
          {deliveryRows.map((d) => (
            <div key={d.id} className="space-y-1 text-sm">
              <p><span className="text-gray-500">Status:</span> <span className="font-medium text-gray-800 capitalize">{d.delivery_status.replace(/_/g, " ")}</span></p>
              {d.courier    && <p><span className="text-gray-500">Courier:</span> {d.courier}</p>}
              {d.tracking_id && <p><span className="text-gray-500">Tracking:</span> <span className="font-mono">{d.tracking_id}</span></p>}
              {d.dispatched_at && <p><span className="text-gray-500">Dispatched:</span> {formatDate(d.dispatched_at)}</p>}
              {d.delivered_at  && <p><span className="text-gray-500">Delivered:</span> {formatDate(d.delivered_at)}</p>}
              {d.notes && <p className="text-gray-500 italic">{d.notes}</p>}
            </div>
          ))}
        </div>
      )}

      <OrderSmartRepliesPanel
        orderId={order.id}
        customerPhone={customer?.phone ?? ""}
        canUseAiSmartReplies={canUseAiSmartReplies}
      />

      {/* Assignment */}
      <OrderAssignmentPanel
        orderId={order.id}
        currentAssigneeId={currentAssignment?.assigned_to ?? null}
        members={assignableMembers}
      />
    </div>
  );
}
