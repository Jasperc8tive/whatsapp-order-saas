import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { radius, useThemeColors } from "../lib/theme";

interface IconButtonProps {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  size?: number;
  color?: string;
  variant?: "ghost" | "surface" | "primary" | "danger";
  disabled?: boolean;
}

export function IconButton({
  icon,
  onPress,
  size = 18,
  color,
  variant = "ghost",
  disabled,
}: IconButtonProps) {
  const colors = useThemeColors();

  const bg =
    variant === "surface"
      ? colors.surfaceAlt
      : variant === "primary"
      ? colors.primaryLight
      : variant === "danger"
      ? colors.dangerLight
      : "transparent";

  const iconColor =
    color ??
    (variant === "primary"
      ? colors.primary
      : variant === "danger"
      ? colors.danger
      : colors.mutedText);

  const pad = variant === "ghost" ? 4 : 9;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, padding: pad, opacity: pressed || disabled ? 0.6 : 1 },
      ]}
    >
      <Feather name={icon} size={size} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
