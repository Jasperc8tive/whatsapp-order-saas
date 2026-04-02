import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { radius, shadows, spacing, typography, useThemeColors } from "../lib/theme";
import type { Product } from "../types/domain";
import { formatCurrency } from "../lib/format";

interface ProductCardProps {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
}

export function ProductCard({ product, onEdit, onDelete }: ProductCardProps) {
  const colors = useThemeColors();

  const stockLevel =
    product.track_inventory && product.stock_quantity != null
      ? product.stock_quantity <= (product.low_stock_threshold ?? 5)
        ? "low"
        : "ok"
      : null;

  return (
    <Pressable
      onPress={onEdit}
      style={({ pressed }) => [
        styles.card,
        shadows.sm,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.94 : 1 },
      ]}
    >
      {/* Status strip */}
      <View
        style={[
          styles.strip,
          {
            backgroundColor: !product.is_active
              ? colors.border
              : stockLevel === "low"
              ? colors.warningLight
              : colors.primaryLight,
          },
        ]}
      />

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={[typography.headingSm, { color: colors.text, flex: 1 }]} numberOfLines={1}>
            {product.name}
          </Text>
          <Text style={[typography.headingMd, { color: colors.primary }]}>
            {formatCurrency(Number(product.price))}
          </Text>
        </View>

        {/* Stock indicator */}
        {product.track_inventory ? (
          <View style={styles.stockRow}>
            <Feather
              name={stockLevel === "low" ? "alert-triangle" : "box"}
              size={12}
              color={stockLevel === "low" ? colors.warning : colors.mutedText}
            />
            <Text
              style={[
                typography.caption,
                {
                  color: stockLevel === "low" ? colors.warning : colors.mutedText,
                  marginLeft: 4,
                },
              ]}
            >
              Stock: {product.stock_quantity ?? 0}
              {stockLevel === "low" && "  · Low stock"}
            </Text>
          </View>
        ) : (
          <Text style={[typography.caption, { color: colors.subtleText }]}>
            {product.is_active ? "Active listing" : "Inactive"}
          </Text>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            onPress={onEdit}
            style={[styles.actionBtn, { backgroundColor: colors.primaryLight }]}
          >
            <Feather name="edit-2" size={13} color={colors.primary} />
            <Text style={[typography.caption, { color: colors.primary, marginLeft: 4 }]}>Edit</Text>
          </Pressable>
          <Pressable
            onPress={onDelete}
            style={[styles.actionBtn, { backgroundColor: colors.dangerLight }]}
          >
            <Feather name="trash-2" size={13} color={colors.danger} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  strip: {
    width: 4,
  },
  body: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
});
