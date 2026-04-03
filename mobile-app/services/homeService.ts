import type { DailyMetrics } from "../types/domain";
import { supabase } from "./supabaseClient";

export const homeService = {
  async getDailyMetrics(): Promise<DailyMetrics> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const today = start.slice(0, 10);

    // Preferred path (migration 018): read from pre-aggregated daily_metrics.
    // This avoids expensive scans on orders at scale.
    const { data: dailyRow, error: dailyErr } = await supabase
      .from("daily_metrics")
      .select("orders_count,revenue")
      .eq("date", today)
      .maybeSingle();

    if (!dailyErr) {
      const pendingDeliveriesRes = await supabase
        .from("deliveries")
        .select("id", { count: "exact", head: true })
        .in("delivery_status", ["not_dispatched", "dispatched", "in_transit"]);

      const ordersToday = Number((dailyRow as any)?.orders_count ?? 0);
      return {
        ordersToday,
        revenueToday: Number((dailyRow as any)?.revenue ?? 0),
        pendingDeliveries: pendingDeliveriesRes.count ?? 0,
        newOrders: ordersToday,
      };
    }

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

  subscribeToDailyMetrics(onChange: () => void): () => void {
    const today = new Date().toISOString().slice(0, 10);

    const channel = supabase
      .channel("daily-metrics-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "daily_metrics",
          filter: `date=eq.${today}`,
        },
        () => onChange()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
