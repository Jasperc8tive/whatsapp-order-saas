import { Feather } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { radius, shadows, spacing, typography, useThemeColors } from "../lib/theme";
import type { Order } from "../types/domain";
import { Avatar } from "./Avatar";
import { StatusBadge } from "./StatusBadge";
import { formatCurrency, formatDateTime } from "../lib/format";

interface OrderCardProps {
  order: Order;
  onPress: () => void;
  onConfirm?: () => void;
  /** compact = used in kanban columns */
  compact?: boolean;
}

export function OrderCard({ order, onPress, onConfirm, compact = false }: OrderCardProps) {
  const colors = useThemeColors();
  const customerName = order.customers?.name ?? "Unknown customer";
  const phone = order.customers?.phone;

  const itemSummary = (order.order_items ?? [])
    .slice(0, 2)
    .map((item) => `${item.quantity}× ${item.product_name}`)
    .join("  ·  ");

  const extraItems = (order.order_items?.length ?? 0) - 2;

  const openWhatsApp = async () => {
    if (!phone) return;
    const msg = encodeURIComponent(`Hi ${customerName}, your WhatsOrder order is being processed.`);
    await Linking.openURL(`https://wa.me/${phone.replace(/\D/g, "")}?text=${msg}`);
  };

  const callCustomer = async () => {
    if (!phone) return;
    await Linking.openURL(`tel:${phone}`);
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.94 : 1,
        },
        compact && styles.compact,
      ]}
    >
      {/* Header row */}
      <View style={styles.header}>
        <Avatar name={customerName} size={compact ? 32 : 40} />
        <View style={styles.headerText}>
          <Text
            style={[typography.headingSm, { color: colors.text }]}
            numberOfLines={1}
          >
            {customerName}
          </Text>
          <Text style={[typography.caption, { color: colors.mutedText }]}>
            {formatDateTime(order.created_at)}
          </Text>
        </View>
        <StatusBadge status={order.order_status} size={compact ? "sm" : "sm"} />
      </View>

      {/* Items */}
      {itemSummary ? (
        <Text
          style={[typography.bodyMd, { color: colors.mutedText, marginTop: spacing.xs }]}
          numberOfLines={1}
        >
          {itemSummary}
          {extraItems > 0 && (
            <Text style={{ color: colors.subtleText }}>{`  +${extraItems} more`}</Text>
          )}
        </Text>
      ) : null}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={[typography.headingMd, { color: colors.text }]}>
          {formatCurrency(Number(order.total_amount))}
        </Text>
        <View style={styles.actions}>
          {onConfirm && order.order_status === "pending" && (
            <Pressable
              onPress={onConfirm}
              style={[styles.actionBtn, { backgroundColor: colors.primaryLight }]}
            >
              <Feather name="check" size={14} color={colors.primary} />
              <Text style={[typography.label, { color: colors.primary, marginLeft: 3 }]}>
                Confirm
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={openWhatsApp}
            style={[styles.actionBtn, { backgroundColor: "#DCFCE7" }]}
          >
            <Feather name="message-circle" size={14} color="#16A34A" />
          </Pressable>
          {phone && (
            <Pressable
              onPress={callCustomer}
              style={[styles.actionBtn, { backgroundColor: colors.surfaceAlt }]}
            >
              <Feather name="phone" size={14} color={colors.mutedText} />
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  compact: {
    padding: spacing.sm + 4,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
});
