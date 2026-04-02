import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MetricCard } from "../components/MetricCard";
import { OrderCard } from "../components/OrderCard";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyState } from "../components/EmptyState";
import { formatCurrency } from "../lib/format";
import { brand, radius, shadows, spacing, typography, useThemeColors } from "../lib/theme";
import type { RootStackParamList } from "../navigation/types";
import { homeService } from "../services/homeService";
import { orderService } from "../services/orderService";
import { useAuthStore } from "../store/authStore";
import type { DailyMetrics, Order } from "../types/domain";

const INITIAL: DailyMetrics = {
  ordersToday: 0,
  revenueToday: 0,
  pendingDeliveries: 0,
  newOrders: 0,
};

export function HomeScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore((state) => state.user);
  const [metrics, setMetrics] = useState<DailyMetrics>(INITIAL);
  const [latestOrders, setLatestOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [data, orders] = await Promise.all([
        homeService.getDailyMetrics(),
        orderService.listOrders(),
      ]);
      setMetrics(data);
      setLatestOrders(orders.slice(0, 5));
    } catch {
      // silent refresh failure
    }
  }, []);

  useEffect(() => {
    load();
    const unsub = orderService.subscribeToOrders(load);
    return unsub;
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* ── Hero header ── */}
        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          <View>
            <Text style={[typography.caption, { color: "rgba(255,255,255,0.75)", letterSpacing: 0.5, textTransform: "uppercase" }]}>
              {greeting}
            </Text>
            <Text style={[typography.displayMd, { color: "#fff", marginTop: 2 }]}>
              {user?.email?.split("@")[0] ?? "Vendor"} 👋
            </Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate("AIDrafts")}
            style={[styles.draftBtn, { backgroundColor: "rgba(255,255,255,0.18)" }]}
          >
            <Feather name="zap" size={16} color="#fff" />
            <Text style={[typography.headingSm, { color: "#fff", marginLeft: 5 }]}>AI Drafts</Text>
          </Pressable>
        </View>

        {/* ── Metric grid ── */}
        <View style={styles.section}>
          <View style={styles.grid}>
            <MetricCard
              label="Orders today"
              value={String(metrics.ordersToday)}
              icon="shopping-bag"
              accent="#2563EB"
            />
            <MetricCard
              label="Revenue today"
              value={formatCurrency(metrics.revenueToday)}
              icon="trending-up"
              accent={brand.green}
            />
          </View>
          <View style={styles.grid}>
            <MetricCard
              label="New orders"
              value={String(metrics.newOrders)}
              icon="bell"
              accent="#7C3AED"
            />
            <MetricCard
              label="Pending delivery"
              value={String(metrics.pendingDeliveries)}
              icon="truck"
              accent="#EA580C"
            />
          </View>
        </View>

        {/* ── Quick actions ── */}
        <View style={styles.section}>
          <SectionHeader title="Quick actions" />
          <View style={styles.quickRow}>
            {[
              { icon: "plus-circle" as const, label: "New Order", screen: "Orders" as const },
              { icon: "users" as const, label: "Customers", screen: "Customers" as const },
              { icon: "package" as const, label: "Products", screen: "Products" as const },
              { icon: "truck" as const, label: "Delivery", screen: "Delivery" as const },
            ].map(({ icon, label, screen }) => (
              <Pressable
                key={label}
                onPress={() => navigation.navigate(screen as any)}
                style={({ pressed }) => [
                  styles.quickBtn,
                  shadows.sm,
                  { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <View style={[styles.quickIcon, { backgroundColor: colors.primaryLight }]}>
                  <Feather name={icon} size={20} color={colors.primary} />
                </View>
                <Text style={[typography.caption, { color: colors.mutedText, marginTop: 5 }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Latest orders ── */}
        <View style={styles.section}>
          <SectionHeader
            title="Latest orders"
            action={{ label: "All orders", icon: "arrow-right", onPress: () => navigation.navigate("Orders" as any) }}
          />
          {latestOrders.length === 0 ? (
            <EmptyState icon="shopping-bag" title="No orders yet" subtitle="Orders from WhatsApp will appear here." />
          ) : (
            latestOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onPress={() => navigation.navigate("OrderDetails", { orderId: order.id })}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  draftBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  grid: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  quickRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  quickBtn: {
    flex: 1,
    alignItems: "center",
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});

