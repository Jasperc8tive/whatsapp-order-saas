import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { radius, shadows, spacing, typography, useThemeColors } from "../lib/theme";

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: keyof typeof Feather.glyphMap;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export function AppButton({
  title,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  style,
  disabled,
}: AppButtonProps) {
  const colors = useThemeColors();

  const bgColor =
    variant === "primary"
      ? colors.primary
      : variant === "danger"
      ? colors.danger
      : variant === "ghost"
      ? "transparent"
      : "transparent";

  const borderColor =
    variant === "primary"
      ? colors.primary
      : variant === "danger"
      ? colors.danger
      : variant === "ghost"
      ? "transparent"
      : colors.border;

  const textColor =
    variant === "primary" || variant === "danger" ? "#ffffff" : colors.text;

  const padV =
    size === "sm" ? spacing.xs : size === "lg" ? spacing.md : 11;
  const padH =
    size === "sm" ? spacing.md : size === "lg" ? spacing.lg : spacing.md;
  const fontSize =
    size === "sm" ? 13 : size === "lg" ? 16 : 15;

  const shadow = variant === "primary" && !disabled ? shadows.sm : undefined;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        shadow,
        {
          backgroundColor: bgColor,
          borderColor,
          paddingVertical: padV,
          paddingHorizontal: padH,
          opacity: pressed || disabled ? 0.75 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <View style={styles.inner}>
          {icon && (
            <Feather name={icon} size={fontSize} color={textColor} style={styles.icon} />
          )}
          <Text style={[typography.headingSm, { color: textColor, fontSize }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1.5,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  icon: {
    marginRight: 2,
  },
});

