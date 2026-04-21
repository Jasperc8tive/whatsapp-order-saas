import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { radius, shadows, spacing, typography, useThemeColors } from "../lib/theme";

interface MetricCardProps {
  label: string;
  value: string;
  icon?: keyof typeof Feather.glyphMap;
  accent?: string;
  trend?: { direction: "up" | "down" | "flat"; label: string };
}

export function MetricCard({ label, value, icon, accent, trend }: MetricCardProps) {
  const colors = useThemeColors();
  const accentColor = accent ?? colors.primary;

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.top}>
        <View style={[styles.iconWrap, { backgroundColor: `${accentColor}18` }]}>
          {icon && <Feather name={icon} size={18} color={accentColor} />}
        </View>
        {trend && (
          <View style={styles.trend}>
            <Feather
              name={trend.direction === "up" ? "trending-up" : trend.direction === "down" ? "trending-down" : "minus"}
              size={12}
              color={trend.direction === "up" ? colors.success : trend.direction === "down" ? colors.danger : colors.mutedText}
            />
            <Text
              style={[
                typography.caption,
                {
                  color:
                    trend.direction === "up"
                      ? colors.success
                      : trend.direction === "down"
                      ? colors.danger
                      : colors.mutedText,
                  marginLeft: 2,
                },
              ]}
            >
              {trend.label}
            </Text>
          </View>
        )}
      </View>
      <Text style={[typography.displayMd, { color: colors.text, marginTop: spacing.sm }]}>{value}</Text>
      <Text style={[typography.caption, { color: colors.mutedText, marginTop: 3 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    minWidth: 150,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  trend: {
    flexDirection: "row",
    alignItems: "center",
  },
});

