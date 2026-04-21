import { Feather } from "@expo/vector-icons";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { EmptyState } from "../components/EmptyState";
import { ScreenContainer } from "../components/ScreenContainer";
import { StatusBadge } from "../components/StatusBadge";
import { Avatar } from "../components/Avatar";
import { formatCurrency } from "../lib/format";
import { radius, shadows, spacing, typography, useThemeColors } from "../lib/theme";
import type { MainTabParamList } from "../navigation/types";
import { deliveryService } from "../services/deliveryService";
import type { Delivery } from "../types/domain";

type Props = BottomTabScreenProps<MainTabParamList, "Delivery">;

const STATUSES: Delivery["delivery_status"][] = [
  "not_dispatched",
  "dispatched",
  "in_transit",
  "delivered",
];

const NEXT_LABEL: Record<string, string> = {
  not_dispatched: "Dispatch",
  dispatched: "In Transit",
  in_transit: "Mark Delivered",
  delivered: "Done",
};

export function DeliveryScreen(_: Props) {
  const colors = useThemeColors();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  const load = useCallback(async () => {
    const rows = await deliveryService.listDeliveries();
    setDeliveries(rows);
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
    const unsub = deliveryService.subscribeToDeliveries(load);
    return unsub;
  }, [load]);

  const advance = async (delivery: Delivery) => {
    const current = STATUSES.indexOf(delivery.delivery_status);
    const next = STATUSES[Math.min(current + 1, STATUSES.length - 1)];
    await deliveryService.updateDeliveryStatus(delivery.id, next);
    await load();
  };

  const pending = deliveries.filter((d) => d.delivery_status !== "delivered");
  const done = deliveries.filter((d) => d.delivery_status === "delivered");

  return (
    <ScreenContainer scroll={false} title="Delivery Queue" noPadding>
      {/* Summary strip */}
      <View style={[styles.strip, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.stripItem}>
          <Text style={[typography.displayMd, { color: colors.primary }]}>{pending.length}</Text>
          <Text style={[typography.caption, { color: colors.mutedText }]}>Active</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.stripItem}>
          <Text style={[typography.displayMd, { color: colors.success }]}>{done.length}</Text>
          <Text style={[typography.caption, { color: colors.mutedText }]}>Delivered today</Text>
        </View>
      </View>

      <FlatList
        data={deliveries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState icon="truck" title="No deliveries" subtitle="Assigned deliveries appear here." />
        }
        renderItem={({ item }) => {
          const customerName = item.orders?.customers?.name ?? "Unknown";
          const isDone = item.delivery_status === "delivered";

          return (
            <View
              style={[
                styles.card,
                shadows.sm,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: isDone ? 0.65 : 1 },
              ]}
            >
              <View style={styles.cardHeader}>
                <Avatar name={customerName} size={40} />
                <View style={styles.cardInfo}>
                  <Text style={[typography.headingSm, { color: colors.text }]}>{customerName}</Text>
                  <Text style={[typography.bodyMd, { color: colors.mutedText }]}>
                    {formatCurrency(Number(item.orders?.total_amount ?? 0))}
                  </Text>
                </View>
                <StatusBadge status={item.delivery_status} type="delivery" size="sm" />
              </View>

              {!isDone && (
                <Pressable
                  onPress={() => advance(item)}
                  style={({ pressed }) => [
                    styles.advanceBtn,
                    { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Feather name="arrow-right" size={14} color="#fff" />
                  <Text style={[typography.headingSm, { color: "#fff", marginLeft: spacing.xs }]}>
                    {NEXT_LABEL[item.delivery_status] ?? "Advance"}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    marginBottom: spacing.sm,
  },
  stripItem: {
    flex: 1,
    alignItems: "center",
  },
  divider: {
    width: 1,
    marginHorizontal: spacing.md,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxxl ?? 80,
    gap: spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  cardInfo: {
    flex: 1,
  },
  advanceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
});
