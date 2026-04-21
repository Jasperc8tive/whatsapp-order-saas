import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { radius, typography, useStatusColors } from "../lib/theme";
import type { DeliveryStatus, OrderStatus } from "../types/domain";

type StatusValue = OrderStatus | DeliveryStatus | string;

const ORDER_LABELS: Record<string, string> = {
  pending: "New",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const DELIVERY_LABELS: Record<string, string> = {
  not_dispatched: "Queued",
  dispatched: "Dispatched",
  in_transit: "In Transit",
  delivered: "Delivered",
  returned: "Returned",
  failed: "Failed",
};

const DELIVERY_STATUS_MAP: Record<string, keyof typeof ORDER_LABELS> = {
  not_dispatched: "confirmed",
  dispatched: "processing",
  in_transit: "shipped",
  delivered: "delivered",
  returned: "cancelled",
  failed: "cancelled",
};

interface StatusBadgeProps {
  status: StatusValue;
  type?: "order" | "delivery" | "payment";
  size?: "sm" | "md";
}

export function StatusBadge({ status, type = "order", size = "md" }: StatusBadgeProps) {
  const statusColors = useStatusColors();

  const colorKey = (
    type === "delivery"
      ? DELIVERY_STATUS_MAP[status] ?? "pending"
      : status
  ) as keyof typeof statusColors;

  const colors = statusColors[colorKey] ?? statusColors.pending;

  const label =
    type === "delivery"
      ? DELIVERY_LABELS[status] ?? status
      : ORDER_LABELS[status] ?? status;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: colors.bg },
        size === "sm" && styles.badgeSm,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: colors.dot }]} />
      <Text
        style={[
          size === "sm" ? typography.caption : typography.label,
          { color: colors.text, textTransform: "uppercase" },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 5,
    alignSelf: "flex-start",
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
