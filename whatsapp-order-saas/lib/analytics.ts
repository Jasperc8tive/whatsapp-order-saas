import type { SupabaseClient } from "@supabase/supabase-js";

export interface DashboardStats {
  totalOrders: number;
  ordersToday: number;
  totalRevenue: number;       // NGN, paid orders only
  repeatCustomers: number;    // customers with more than 1 order
  // Week-over-week deltas (positive = growth)
  ordersWoW: number;          // absolute difference
  revenueWoW: number;         // absolute difference in NGN
}

export interface RecentOrder {
  id: string;
  orderRef: string;
  customerName: string;
  customerPhone: string;
  firstItem: string;
  itemCount: number;
  totalAmount: number;
  orderStatus: string;
  paymentStatus: string;
  createdAt: string;
}

export interface RecommendationAnalytics {
  totalImpressions: number;      // times the panel showed results
  totalAccepts: number;          // "Add To New Order" clicks
  totalCatalogClicks: number;    // "View Product" clicks
  acceptRate: number;            // accepts / impressions
  catalogClickRate: number;      // catalog_clicks / impressions
  byDay: Array<{
    day: string;                 // YYYY-MM-DD
    impressions: number;
    accepts: number;
    catalogClicks: number;
  }>;
}

export interface SmartReplyAnalytics {
  totalGenerated: number;
  totalCopied: number;
  totalWhatsAppClicked: number;
  copyRate: number;        // copied / generated
  whatsappRate: number;    // whatsapp_clicked / generated
  byDay: Array<{
    day: string;          // YYYY-MM-DD
    generated: number;
    copied: number;
    whatsappClicked: number;
  }>;
  bySurface: Array<{
    surface: "kanban_card" | "order_detail";
    generated: number;
    copied: number;
    whatsappClicked: number;
  }>;
}

/**
 * Fetch all dashboard analytics for the given vendor (user.id).
 * Uses Promise.all to run independent queries concurrently.
 */
export async function getDashboardStats(
  supabase: SupabaseClient,
  vendorId: string
): Promise<DashboardStats> {
  // Date boundaries (UTC)
  const now        = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  // This week: last 7 days
  const thisWeekStart = new Date(now);
  thisWeekStart.setUTCDate(now.getUTCDate() - 7);

  // Last week: 14–7 days ago
  const lastWeekStart = new Date(now);
  lastWeekStart.setUTCDate(now.getUTCDate() - 14);

  const [
    totalResult,
    todayResult,
    revenueResult,
    repeatResult,
    thisWeekResult,
    lastWeekResult,
    thisWeekRevenueResult,
    lastWeekRevenueResult,
  ] = await Promise.all([
    // 1. Total orders
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("vendor_id", vendorId),

    // 2. Orders today
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("vendor_id", vendorId)
      .gte("created_at", todayStart.toISOString()),

    // 3. Total revenue (paid orders only)
    supabase
      .from("orders")
      .select("total_amount")
      .eq("vendor_id", vendorId)
      .eq("payment_status", "paid"),

    // 4. Repeat customers: customers with >1 order for this vendor
    supabase
      .from("orders")
      .select("customer_id")
      .eq("vendor_id", vendorId)
      .not("customer_id", "is", null),

    // 5. Orders this week (last 7 days)
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("vendor_id", vendorId)
      .gte("created_at", thisWeekStart.toISOString()),

    // 6. Orders last week (14–7 days ago)
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("vendor_id", vendorId)
      .gte("created_at", lastWeekStart.toISOString())
      .lt("created_at", thisWeekStart.toISOString()),

    // 7. Revenue this week
    supabase
      .from("orders")
      .select("total_amount")
      .eq("vendor_id", vendorId)
      .eq("payment_status", "paid")
      .gte("created_at", thisWeekStart.toISOString()),

    // 8. Revenue last week
    supabase
      .from("orders")
      .select("total_amount")
      .eq("vendor_id", vendorId)
      .eq("payment_status", "paid")
      .gte("created_at", lastWeekStart.toISOString())
      .lt("created_at", thisWeekStart.toISOString()),
  ]);

  // Aggregate total revenue
  const totalRevenue = (revenueResult.data ?? []).reduce(
    (sum, row) => sum + Number(row.total_amount ?? 0),
    0
  );

  // Count repeat customers: customer_ids that appear more than once
  const customerIds = (repeatResult.data ?? [])
    .map((r) => r.customer_id as string)
    .filter(Boolean);
  const idFrequency = customerIds.reduce<Record<string, number>>((acc, id) => {
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {});
  const repeatCustomers = Object.values(idFrequency).filter((count) => count > 1).length;

  // Week-over-week deltas
  const thisWeekOrders  = thisWeekResult.count  ?? 0;
  const lastWeekOrders  = lastWeekResult.count  ?? 0;
  const thisWeekRevenue = (thisWeekRevenueResult.data ?? []).reduce(
    (sum, r) => sum + Number(r.total_amount ?? 0), 0
  );
  const lastWeekRevenue = (lastWeekRevenueResult.data ?? []).reduce(
    (sum, r) => sum + Number(r.total_amount ?? 0), 0
  );

  return {
    totalOrders:      totalResult.count   ?? 0,
    ordersToday:      todayResult.count   ?? 0,
    totalRevenue,
    repeatCustomers,
    ordersWoW:        thisWeekOrders  - lastWeekOrders,
    revenueWoW:       thisWeekRevenue - lastWeekRevenue,
  };
}

/**
 * Fetch Smart Reply analytics for the last 7 days.
 */
export async function getSmartReplyAnalytics(
  supabase: SupabaseClient,
  vendorId: string
): Promise<SmartReplyAnalytics> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

  const { data: activities } = await supabase
    .from("activity_logs")
    .select("action, created_at, meta")
    .eq("workspace_id", vendorId)
    .in("action", [
      "smart_reply_generated",
      "smart_reply_copied",
      "smart_reply_whatsapp_clicked",
    ])
    .gte("created_at", sevenDaysAgo.toISOString())
    .order("created_at", { ascending: true });

  const acts = (activities ?? []) as Array<{
    action: string;
    created_at: string;
    meta: Record<string, unknown>;
  }>;

  // Initialize aggregates
  const byDayMap = new Map<
    string,
    { generated: number; copied: number; whatsappClicked: number }
  >();
  const bySurfaceMap = new Map<
    "kanban_card" | "order_detail",
    { generated: number; copied: number; whatsappClicked: number }
  >();

  bySurfaceMap.set("kanban_card", {
    generated: 0,
    copied: 0,
    whatsappClicked: 0,
  });
  bySurfaceMap.set("order_detail", {
    generated: 0,
    copied: 0,
    whatsappClicked: 0,
  });

  let totalGenerated = 0;
  let totalCopied = 0;
  let totalWhatsAppClicked = 0;

  // Process events
  for (const act of acts) {
    const date = new Date(act.created_at);
    const dayString = date.toISOString().split("T")[0];
    const surface = (act.meta?.surface as "kanban_card" | "order_detail") ?? "kanban_card";

    if (!byDayMap.has(dayString)) {
      byDayMap.set(dayString, { generated: 0, copied: 0, whatsappClicked: 0 });
    }

    const dayData = byDayMap.get(dayString)!;
    const surfaceData = bySurfaceMap.get(surface)!;

    if (act.action === "smart_reply_generated") {
      dayData.generated++;
      surfaceData.generated++;
      totalGenerated++;
    } else if (act.action === "smart_reply_copied") {
      dayData.copied++;
      surfaceData.copied++;
      totalCopied++;
    } else if (act.action === "smart_reply_whatsapp_clicked") {
      dayData.whatsappClicked++;
      surfaceData.whatsappClicked++;
      totalWhatsAppClicked++;
    }
  }

  const byDay = Array.from(byDayMap.entries())
    .map(([day, counts]) => ({
      day,
      ...counts,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const bySurface = Array.from(bySurfaceMap.entries())
    .map(([surface, counts]) => ({
      surface,
      ...counts,
    }))
    .filter((s) => s.generated > 0);

  const copyRate = totalGenerated > 0 ? totalCopied / totalGenerated : 0;
  const whatsappRate = totalGenerated > 0 ? totalWhatsAppClicked / totalGenerated : 0;

  return {
    totalGenerated,
    totalCopied,
    totalWhatsAppClicked,
    copyRate,
    whatsappRate,
    byDay,
    bySurface,
  };
}

/**
 * Fetch Product Recommendation funnel analytics for the last 7 days.
 */
export async function getRecommendationAnalytics(
  supabase: SupabaseClient,
  vendorId: string
): Promise<RecommendationAnalytics> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

  const { data: activities } = await supabase
    .from("activity_logs")
    .select("action, created_at")
    .eq("workspace_id", vendorId)
    .in("action", [
      "product_recommendation_impression",
      "product_recommendation_accepted",
      "product_recommendation_catalog_click",
    ])
    .gte("created_at", sevenDaysAgo.toISOString())
    .order("created_at", { ascending: true });

  const acts = (activities ?? []) as Array<{
    action: string;
    created_at: string;
  }>;

  const byDayMap = new Map<
    string,
    { impressions: number; accepts: number; catalogClicks: number }
  >();

  let totalImpressions    = 0;
  let totalAccepts        = 0;
  let totalCatalogClicks  = 0;

  for (const act of acts) {
    const dayString = new Date(act.created_at).toISOString().split("T")[0];
    if (!byDayMap.has(dayString)) {
      byDayMap.set(dayString, { impressions: 0, accepts: 0, catalogClicks: 0 });
    }
    const d = byDayMap.get(dayString)!;
    if (act.action === "product_recommendation_impression") {
      d.impressions++; totalImpressions++;
    } else if (act.action === "product_recommendation_accepted") {
      d.accepts++; totalAccepts++;
    } else if (act.action === "product_recommendation_catalog_click") {
      d.catalogClicks++; totalCatalogClicks++;
    }
  }

  const byDay = Array.from(byDayMap.entries())
    .map(([day, counts]) => ({ day, ...counts }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return {
    totalImpressions,
    totalAccepts,
    totalCatalogClicks,
    acceptRate:       totalImpressions > 0 ? totalAccepts       / totalImpressions : 0,
    catalogClickRate: totalImpressions > 0 ? totalCatalogClicks / totalImpressions : 0,
    byDay,
  };
}

/**
 * Fetch the 5 most recent orders for the activity feed.
 */
export async function getRecentOrders(
  supabase: SupabaseClient,
  vendorId: string,
  limit = 5
): Promise<RecentOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `id, order_status, payment_status, total_amount, created_at,
       customers ( name, phone ),
       order_items ( product_name, quantity )`
    )
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => {
    const customer = (row.customers as unknown) as { name: string; phone: string } | null;
    const items    = (row.order_items as unknown) as Array<{ product_name: string; quantity: number }> | null ?? [];
    const first    = items[0];

    return {
      id:            row.id,
      orderRef:      row.id.slice(0, 8).toUpperCase(),
      customerName:  customer?.name  ?? "Unknown",
      customerPhone: customer?.phone ?? "",
      firstItem:     first ? `${first.quantity}× ${first.product_name}` : "—",
      itemCount:     items.length,
      totalAmount:   Number(row.total_amount ?? 0),
      orderStatus:   row.order_status  as string,
      paymentStatus: row.payment_status as string,
      createdAt:     row.created_at as string,
    };
  });
}
