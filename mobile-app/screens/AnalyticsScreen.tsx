import React, { useCallback, useEffect, useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";

import { AppButton } from "../components/AppButton";
import { ScreenContainer } from "../components/ScreenContainer";
import { showCreateError } from "../lib/alertHelpers";
import { ALERT_TITLES } from "../lib/alertTitles";
import { formatCurrency } from "../lib/format";
import {
  clearInlineError,
  setAnalyticsInlineError,
  setAnalyticsInlineErrorMessage,
} from "../lib/inlineErrorHelpers";
import { useThemeColors } from "../lib/theme";
import { analyticsService, type AnalyticsOverview, type AnalyticsRange } from "../services/analyticsService";
import { homeService } from "../services/homeService";
import type { DailyMetrics } from "../types/domain";

const rangeButtons: AnalyticsRange[] = ["7d", "30d", "90d"];

const EMPTY_DAILY_METRICS: DailyMetrics = {
  ordersToday: 0,
  revenueToday: 0,
  pendingDeliveries: 0,
  newOrders: 0,
};

export function AnalyticsScreen() {
  const colors = useThemeColors();
  const [range, setRange] = useState<AnalyticsRange>("7d");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [todayMetrics, setTodayMetrics] = useState<DailyMetrics>(EMPTY_DAILY_METRICS);
  const [lastLiveSyncAt, setLastLiveSyncAt] = useState<Date | null>(null);
  const [todayKpiError, setTodayKpiError] = useState<string | null>(null);

  const loadTodayKpis = useCallback(async (source: "manual" | "realtime" = "manual") => {
    try {
      const data = await homeService.getDailyMetrics();
      setTodayMetrics(data);
      clearInlineError(setTodayKpiError);
      if (source === "realtime") {
        setLastLiveSyncAt(new Date());
      }
    } catch (error) {
      setAnalyticsInlineError(setTodayKpiError, error, "liveKpis");
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await analyticsService.getOverview(range);
        setOverview(response);
        clearInlineError(setLoadError);
      } catch (error) {
        setAnalyticsInlineError(setLoadError, error);
      } finally {
        setLoading(false);
      }
    };

    load().catch(() => {
      setOverview(null);
      setAnalyticsInlineErrorMessage(setLoadError);
    });
  }, [range]);

  useEffect(() => {
    loadTodayKpis();
    const unsub = homeService.subscribeToDailyMetrics(() => loadTodayKpis("realtime"));
    return () => {
      unsub();
    };
  }, [loadTodayKpis]);

  const maxRevenue = Math.max(...(overview?.ordersPerDay.map((item) => item.revenue) ?? [1]), 1);

  const exportCsv = async () => {
    try {
      setExporting(true);
      const { fileUri, fileName } = await analyticsService.downloadOverviewCsv(range);
      await Share.share({
        url: fileUri,
        message: `Analytics CSV (${range.toUpperCase()})`,
        title: fileName,
      });
    } catch (error) {
      showCreateError(ALERT_TITLES.error.unableToExportAnalytics, error, "Unable to export analytics right now.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScreenContainer>
      <Text style={[styles.title, { color: colors.text }]}>Analytics</Text>
      <View style={styles.filterRow}>
        {rangeButtons.map((value) => (
          <AppButton
            key={value}
            title={value.toUpperCase()}
            variant={range === value ? "primary" : "secondary"}
            onPress={() => setRange(value)}
            disabled={loading}
          />
        ))}
      </View>
      <Text style={{ color: colors.mutedText }}>
        {loading ? "Loading analytics..." : `Server-side analytics for ${range.toUpperCase()}`}
      </Text>
      {loadError ? (
        <Text style={{ color: "#B45309", fontWeight: "600" }}>{loadError}</Text>
      ) : null}
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={styles.liveHeaderRow}>
          <Text style={{ color: colors.text, fontWeight: "700" }}>Today (Live)</Text>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={{ color: colors.mutedText, fontSize: 12, fontWeight: "700" }}>Live</Text>
          </View>
        </View>
        <Text style={{ color: colors.mutedText }}>Orders: {todayMetrics.ordersToday}</Text>
        <Text style={{ color: colors.mutedText }}>Revenue: {formatCurrency(todayMetrics.revenueToday)}</Text>
        <Text style={{ color: colors.mutedText }}>Pending delivery: {todayMetrics.pendingDeliveries}</Text>
        {todayKpiError ? (
          <Text style={{ color: "#B45309", fontWeight: "600" }}>{todayKpiError}</Text>
        ) : null}
        {lastLiveSyncAt ? (
          <Text style={{ color: colors.mutedText, fontSize: 12 }}>
            Last live sync {lastLiveSyncAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        ) : null}
      </View>
      <AppButton
        title={exporting ? "Preparing CSV..." : "Download CSV"}
        variant="secondary"
        onPress={exportCsv}
        disabled={loading || exporting}
      />

      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Text style={{ color: colors.text, fontWeight: "700" }}>Summary</Text>
        <Text style={{ color: colors.mutedText }}>Orders: {overview?.summary.totalOrders ?? 0}</Text>
        <Text style={{ color: colors.mutedText }}>Revenue: {formatCurrency(overview?.summary.totalRevenue ?? 0)}</Text>
        <Text style={{ color: colors.mutedText }}>
          Avg order value: {formatCurrency(overview?.summary.averageOrderValue ?? 0)}
        </Text>
      </View>

      <Text style={{ color: colors.mutedText }}>Orders per day</Text>
      {(overview?.ordersPerDay ?? []).map((item) => {
        const day = new Date(item.date).toLocaleDateString("en-NG", { month: "short", day: "numeric" });
        const revenue = item.revenue;
        const widthPercent = Math.max(8, Math.round((revenue / maxRevenue) * 100));
        return (
          <View key={item.date} style={styles.row}>
            <Text style={[styles.day, { color: colors.mutedText }]}>{day}</Text>
            <View style={[styles.barTrack, { borderColor: colors.border }]}>
              <View style={[styles.barFill, { width: `${widthPercent}%`, backgroundColor: colors.primary }]} />
            </View>
            <Text style={[styles.value, { color: colors.text }]}>
              {formatCurrency(revenue)} ({item.orders} orders)
            </Text>
          </View>
        );
      })}

      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Text style={{ color: colors.text, fontWeight: "700" }}>Top customers</Text>
        {(overview?.topCustomers ?? []).slice(0, 5).map((customer) => (
          <Text key={customer.customerId} style={{ color: colors.mutedText }}>
            {customer.name} • {customer.totalOrders} orders • {formatCurrency(customer.totalSpent)}
          </Text>
        ))}
      </View>

      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Text style={{ color: colors.text, fontWeight: "700" }}>Top products</Text>
        {(overview?.topProducts ?? []).slice(0, 5).map((product) => (
          <Text key={product.productName} style={{ color: colors.mutedText }}>
            {product.productName} • {product.unitsSold} sold • {formatCurrency(product.revenue)}
          </Text>
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  row: {
    gap: 8,
  },
  day: {
    fontSize: 12,
  },
  barTrack: {
    borderWidth: 1,
    borderRadius: 12,
    height: 12,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 12,
  },
  value: {
    fontSize: 12,
    fontWeight: "600",
  },
  liveHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#22C55E",
  },
});
