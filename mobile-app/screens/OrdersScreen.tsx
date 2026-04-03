import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DraggableOrderCard } from "../components/DraggableOrderCard";
import { EmptyState } from "../components/EmptyState";
import { showLoadError, showUpdateError } from "../lib/alertHelpers";
import { ALERT_TITLES } from "../lib/alertTitles";
import { radius, shadows, spacing, statusColors, statusColorsDark, typography, useThemeColors } from "../lib/theme";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";
import { orderService } from "../services/orderService";
import { useOrderStore } from "../store/orderStore";
import type { OrderStatus } from "../types/domain";
import { useColorScheme } from "react-native";

type Props = BottomTabScreenProps<MainTabParamList, "Orders">;

const KANBAN: Array<{ key: OrderStatus; label: string }> = [
  { key: "pending", label: "New" },
  { key: "confirmed", label: "Confirmed" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
];

export function OrdersScreen(_: Props) {
  const colors = useThemeColors();
  const scheme = useColorScheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const orders = useOrderStore((state) => state.orders);
  const setOrders = useOrderStore((state) => state.setOrders);
  const patchOrderStatus = useOrderStore((state) => state.patchOrderStatus);
  const [loading, setLoading] = useState(false);

  const sc = scheme === "dark" ? statusColorsDark : statusColors;

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await orderService.listOrders();
      setOrders(rows);
    } catch (error) {
      showLoadError(ALERT_TITLES.error.unableToLoadOrders, error, "Unable to load orders right now.");
    } finally {
      setLoading(false);
    }
  }, [setOrders]);

  useEffect(() => {
    loadOrders();
    const unsub = orderService.subscribeToOrders(loadOrders);
    return unsub;
  }, [loadOrders]);

  const grouped = useMemo(() => {
    return KANBAN.map((column) => ({
      ...column,
      orders: orders.filter((order) => order.order_status === column.key),
    }));
  }, [orders]);

  const onMove = async (orderId: string, status: OrderStatus) => {
    patchOrderStatus(orderId, status);
    try {
      await orderService.updateOrderStatus(orderId, status);
    } catch (error) {
      showUpdateError(ALERT_TITLES.error.unableToUpdateOrder, error, "Unable to update this order right now.");
      await loadOrders();
    }
  };

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, shadows.sm, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[typography.headingLg, { color: colors.text }]}>Orders</Text>
          <Text style={[typography.caption, { color: colors.mutedText }]}>
            {loading ? "Syncing…" : `${orders.length} total · drag card to move`}
          </Text>
        </View>
      </View>

      {/* Kanban board */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.board}
      >
        {grouped.map((column) => {
          const colColors = sc[column.key as keyof typeof sc] ?? sc.pending;

          return (
            <View
              key={column.key}
              style={[styles.column, shadows.sm, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              {/* Column header */}
              <View style={[styles.columnHeader, { backgroundColor: colColors.bg, borderRadius: radius.md }]}>
                <View style={[styles.dot, { backgroundColor: colColors.dot }]} />
                <Text style={[typography.headingSm, { color: colColors.text }]}>
                  {column.label}
                </Text>
                <View style={[styles.countBadge, { backgroundColor: colColors.dot }]}>
                  <Text style={[typography.label, { color: "#fff" }]}>{column.orders.length}</Text>
                </View>
              </View>

              {/* Cards */}
              <ScrollView showsVerticalScrollIndicator={false} style={styles.cardList}>
                {column.orders.length === 0 ? (
                  <EmptyState icon="inbox" title="Empty" />
                ) : (
                  column.orders.map((order) => (
                    <DraggableOrderCard
                      key={order.id}
                      order={order}
                      statuses={KANBAN.map((item) => item.key)}
                      onPress={() => navigation.navigate("OrderDetails", { orderId: order.id })}
                      onStatusMove={(nextStatus) => onMove(order.id, nextStatus)}
                    />
                  ))
                )}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  board: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  column: {
    width: 280,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.sm,
    maxHeight: "100%",
  },
  columnHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  countBadge: {
    marginLeft: "auto",
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  cardList: {
    flex: 1,
  },
});
