import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { radius, spacing, typography, useThemeColors } from "../lib/theme";

interface AvatarProps {
  name: string;
  size?: number;
  color?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// Deterministic color from name
const AVATAR_COLORS = [
  "#16A34A", "#2563EB", "#7C3AED", "#DB2777", "#EA580C",
  "#0891B2", "#65A30D", "#D97706", "#9333EA", "#DC2626",
];

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}

export function Avatar({ name, size = 40, color }: AvatarProps) {
  const bg = color ?? hashColor(name);
  const initials = getInitials(name);
  const fontSize = Math.round(size * 0.38);

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}
    >
      <Text style={[typography.label, { color: "#fff", fontSize, letterSpacing: 0.5 }]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
  },
});
