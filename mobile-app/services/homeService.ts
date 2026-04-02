import type { DailyMetrics } from "../types/domain";
import { supabase } from "./supabaseClient";

export const homeService = {
  async getDailyMetrics(): Promise<DailyMetrics> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const [ordersTodayRes, revenueRes, pendingDeliveriesRes] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", start),
      supabase.from("orders").select("total_amount").gte("created_at", start),
      supabase
        .from("deliveries")
        .select("id", { count: "exact", head: true })
        .in("delivery_status", ["not_dispatched", "dispatched", "in_transit"]),
    ]);

    const revenueToday = (revenueRes.data ?? []).reduce(
      (sum: number, row: any) => sum + Number(row.total_amount ?? 0),
      0
    );

    return {
      ordersToday: ordersTodayRes.count ?? 0,
      revenueToday,
      pendingDeliveries: pendingDeliveriesRes.count ?? 0,
      newOrders: ordersTodayRes.count ?? 0,
    };
  },
};
