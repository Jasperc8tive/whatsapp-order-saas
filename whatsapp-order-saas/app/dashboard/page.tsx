import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { getDashboardStats, getRecentOrders, getSmartReplyAnalytics, getRecommendationAnalytics } from "@/lib/analytics";
import { formatCurrency, formatRelativeTime, ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from "@/lib/utils";
import { SmartReplyAnalyticsWidget } from "@/components/SmartReplyAnalyticsWidget";
import { RecommendationAnalyticsWidget } from "@/components/RecommendationAnalyticsWidget";
import type { OrderStatus } from "@/types/order";

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
  positive: boolean | null;  // null = neutral (no directional indicator)
  icon: React.ReactNode;
  accent: string;
}

function StatCard({ label, value, sub, positive, icon, accent }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <div className={`w-9 h-9 rounded-lg ${accent} flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
        {positive !== null ? (
          <p className={`text-xs mt-1.5 font-medium flex items-center gap-1 ${positive ? "text-green-600" : "text-red-500"}`}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d={positive ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
            </svg>
            {sub}
          </p>
        ) : (
          <p className="text-xs mt-1.5 text-gray-400">{sub}</p>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [stats, recentOrders, smartReplyAnalytics, recommendationAnalytics] = await Promise.all([
    getDashboardStats(supabase, user.id),
    getRecentOrders(supabase, user.id, 6),
    getSmartReplyAnalytics(supabase, user.id),
    getRecommendationAnalytics(supabase, user.id),
  ]);

  const ordersWoWLabel = stats.ordersWoW === 0
    ? "No change vs last week"
    : `${stats.ordersWoW > 0 ? "+" : ""}${stats.ordersWoW} vs last week`;

  const revenueWoWLabel = stats.revenueWoW === 0
    ? "No change vs last week"
    : `${stats.revenueWoW > 0 ? "+" : "-"}${formatCurrency(Math.abs(stats.revenueWoW))} vs last week`;

  const statCards: StatCardProps[] = [
    {
      label:    "Total Orders",
      value:    stats.totalOrders.toLocaleString(),
      sub:      ordersWoWLabel,
      positive: stats.ordersWoW === 0 ? null : stats.ordersWoW > 0,
      accent:   "bg-blue-50",
      icon: (
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      label:    "Orders Today",
      value:    stats.ordersToday.toLocaleString(),
      sub:      stats.ordersToday === 1 ? "1 order so far today" : `${stats.ordersToday} orders so far today`,
      positive: null,
      accent:   "bg-violet-50",
      icon: (
        <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label:    "Total Revenue",
      value:    formatCurrency(stats.totalRevenue),
      sub:      revenueWoWLabel,
      positive: stats.revenueWoW === 0 ? null : stats.revenueWoW > 0,
      accent:   "bg-green-50",
      icon: (
        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label:    "Repeat Customers",
      value:    stats.repeatCustomers.toLocaleString(),
      sub:      stats.repeatCustomers === 1 ? "1 customer ordered again" : `${stats.repeatCustomers} customers with 2+ orders`,
      positive: null,
      accent:   "bg-orange-50",
      icon: (
        <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* ── Recent orders feed ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Recent Orders</h2>
          <Link href="/dashboard/orders" className="text-xs text-green-600 font-medium hover:underline">
            View all →
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-gray-400 mb-1">No orders yet.</p>
            <p className="text-xs text-gray-400">Share your store link to start receiving orders.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {recentOrders.map((order) => (
              <li key={order.id}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">

                {/* Avatar + name + first item */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {order.customerName[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{order.customerName}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {order.firstItem}
                      {order.itemCount > 1 && (
                        <span className="text-gray-400"> +{order.itemCount - 1} more</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Status badges + amount + time */}
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <span className={`hidden sm:inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    ORDER_STATUS_COLORS[order.orderStatus as OrderStatus] ?? "bg-gray-100 text-gray-600"
                  }`}>
                    {ORDER_STATUS_LABELS[order.orderStatus as OrderStatus] ?? order.orderStatus}
                  </span>

                  {order.paymentStatus === "paid" && (
                    <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Paid
                    </span>
                  )}

                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(order.totalAmount)}</p>
                    <p className="text-[10px] text-gray-400">{formatRelativeTime(order.createdAt)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Status breakdown ── */}
      <StatusBreakdown orders={recentOrders} />

      {/* ── Smart Reply Analytics ── */}
      <SmartReplyAnalyticsWidget analytics={smartReplyAnalytics} />

      {/* ── Recommendation Analytics ── */}
      <RecommendationAnalyticsWidget analytics={recommendationAnalytics} />

    </div>
  );
}

// ── Order status breakdown (derived from the recent-orders sample) ────────────

function StatusBreakdown({ orders }: { orders: Array<{ orderStatus: string }> }) {
  if (orders.length === 0) return null;

  const counts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.orderStatus] = (acc[o.orderStatus] ?? 0) + 1;
    return acc;
  }, {});

  const total = orders.length;

  const segments = (
    [
      { status: "pending",    bar: "bg-yellow-400" },
      { status: "confirmed",  bar: "bg-blue-400"   },
      { status: "processing", bar: "bg-violet-400" },
      { status: "shipped",    bar: "bg-indigo-400" },
      { status: "delivered",  bar: "bg-green-500"  },
      { status: "cancelled",  bar: "bg-red-400"    },
    ] as const
  ).filter((s) => (counts[s.status] ?? 0) > 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-800 mb-4">Order status breakdown</h2>

      {/* Stacked bar */}
      <div className="flex h-2.5 rounded-full overflow-hidden gap-px mb-4">
        {segments.map(({ status, bar }) => (
          <div
            key={status}
            className={`${bar} first:rounded-l-full last:rounded-r-full`}
            style={{ width: `${((counts[status] ?? 0) / total) * 100}%` }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {segments.map(({ status, bar }) => (
          <div key={status} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${bar}`} />
            <span className="font-medium">{ORDER_STATUS_LABELS[status]}</span>
            <span className="text-gray-400">{counts[status]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
