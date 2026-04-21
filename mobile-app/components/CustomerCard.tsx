import { Feather } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { radius, shadows, spacing, typography, useThemeColors } from "../lib/theme";
import type { Customer } from "../types/domain";
import { Avatar } from "./Avatar";
import { formatCurrency } from "../lib/format";

interface CustomerCardProps {
  customer: Customer;
  onPress: () => void;
}

export function CustomerCard({ customer, onPress }: CustomerCardProps) {
  const colors = useThemeColors();

  const callCustomer = async () => {
    await Linking.openURL(`tel:${customer.phone}`);
  };

  const openWhatsApp = async () => {
    await Linking.openURL(
      `https://wa.me/${customer.phone.replace(/\D/g, "")}`
    );
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        shadows.sm,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.94 : 1 },
      ]}
    >
      <View style={styles.left}>
        <Avatar name={customer.name} size={44} />
        <View style={styles.info}>
          <Text style={[typography.headingSm, { color: colors.text }]} numberOfLines={1}>
            {customer.name}
          </Text>
          <Text style={[typography.bodyMd, { color: colors.mutedText }]}>{customer.phone}</Text>
          {(customer.total_orders ?? 0) > 0 && (
            <Text style={[typography.caption, { color: colors.subtleText }]}>
              {customer.total_orders} orders ·{" "}
              {formatCurrency(Number(customer.total_spent ?? 0))}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={openWhatsApp}
          style={[styles.actionBtn, { backgroundColor: "#DCFCE7" }]}
        >
          <Feather name="message-circle" size={16} color="#16A34A" />
        </Pressable>
        <Pressable
          onPress={callCustomer}
          style={[styles.actionBtn, { backgroundColor: colors.surfaceAlt }]}
        >
          <Feather name="phone" size={16} color={colors.mutedText} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
