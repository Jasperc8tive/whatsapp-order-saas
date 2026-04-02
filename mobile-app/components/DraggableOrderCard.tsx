import React, { useMemo, useRef } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { formatCurrency, formatDateTime } from "../lib/format";
import { radius, shadows, spacing, typography, useThemeColors } from "../lib/theme";
import type { Order, OrderStatus } from "../types/domain";
import { Avatar } from "./Avatar";
import { StatusBadge } from "./StatusBadge";

interface Props {
  order: Order;
  statuses: OrderStatus[];
  onPress: () => void;
  onStatusMove: (nextStatus: OrderStatus) => void;
}

export function DraggableOrderCard({ order, statuses, onPress, onStatusMove }: Props) {
  const colors = useThemeColors();
  const translate = useRef(new Animated.ValueXY()).current;

  const currentIndex = useMemo(() => {
    const index = statuses.findIndex((status) => status === order.order_status);
    return index === -1 ? 0 : index;
  }, [order.order_status, statuses]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gestureState) =>
          Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10,
        onPanResponderMove: Animated.event([null, { dx: translate.x, dy: translate.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_evt, gestureState) => {
          let targetIndex = currentIndex;
          if (gestureState.dx > 60) targetIndex = Math.min(currentIndex + 1, statuses.length - 1);
          if (gestureState.dx < -60) targetIndex = Math.max(currentIndex - 1, 0);

          const nextStatus = statuses[targetIndex];
          if (nextStatus && nextStatus !== order.order_status) {
            onStatusMove(nextStatus);
          }

          Animated.spring(translate, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        },
      }),
    [currentIndex, onStatusMove, order.order_status, statuses, translate]
  );

  const itemSummary = (order.order_items ?? [])
    .slice(0, 2)
    .map((item) => `${item.quantity}x ${item.product_name}`)
    .join(", ");

  return (
    <Animated.View
      style={[
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          transform: [{ translateX: translate.x }, { translateY: translate.y }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <Pressable onPress={onPress}>
        <View style={styles.header}>
          <Avatar name={order.customers?.name ?? "?"} size={30} />
          <Text style={[typography.headingSm, { color: colors.text, flex: 1 }]} numberOfLines={1}>
            {order.customers?.name ?? "Unknown"}
          </Text>
          <StatusBadge status={order.order_status} size="sm" />
        </View>
        <Text style={[typography.bodyMd, { color: colors.mutedText, marginTop: spacing.xs }]} numberOfLines={1}>
          {itemSummary || "No items"}
        </Text>
        <View style={styles.row}>
          <Text style={[typography.headingMd, { color: colors.text }]}>{formatCurrency(Number(order.total_amount))}</Text>
          <Text style={[typography.caption, { color: colors.subtleText }]}>{formatDateTime(order.created_at)}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
});
