import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { radius, spacing, typography, useThemeColors } from "../lib/theme";

interface SectionHeaderProps {
  title: string;
  /** Optional action link shown on the right */
  action?: { label: string; icon?: keyof typeof Feather.glyphMap; onPress: () => void };
  /** Top margin; defaults to 8 */
  marginTop?: number;
}

export function SectionHeader({ title, action, marginTop = spacing.sm }: SectionHeaderProps) {
  const colors = useThemeColors();

  return (
    <View style={[styles.row, { marginTop }]}>
      <Text style={[typography.headingMd, { color: colors.text }]}>{title}</Text>
      {action && (
        <Pressable
          onPress={action.onPress}
          style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[typography.bodySm, { color: colors.primary }]}>{action.label}</Text>
          {action.icon && (
            <Feather name={action.icon} size={13} color={colors.primary} style={{ marginLeft: 3 }} />
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
});
