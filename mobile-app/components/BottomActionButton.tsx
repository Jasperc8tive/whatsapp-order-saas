import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { radius, shadows, spacing, typography, useThemeColors } from "../lib/theme";

interface BottomActionButtonProps {
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  onPress: () => void;
  position?: "right" | "center";
}

export function BottomActionButton({
  label,
  icon = "plus",
  onPress,
  position = "right",
}: BottomActionButtonProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        shadows.lg,
        {
          backgroundColor: colors.primary,
          alignSelf: position === "center" ? "center" : "flex-end",
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Feather name={icon} size={20} color="#fff" />
      <Text style={[typography.headingSm, { color: "#fff", marginLeft: spacing.xs }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    position: "absolute",
    bottom: spacing.xl,
    right: spacing.md,
  },
});
