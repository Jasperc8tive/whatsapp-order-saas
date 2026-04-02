import { useColorScheme } from "react-native";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
export const brand = {
  green: "#16A34A",
  greenLight: "#DCFCE7",
  greenDark: "#15803D",
};

// ─── Status colors (light) ────────────────────────────────────────────────────
export const statusColors = {
  pending: { bg: "#DBEAFE", text: "#1D4ED8", dot: "#3B82F6" },      // New – blue
  confirmed: { bg: "#FEF9C3", text: "#854D0E", dot: "#EAB308" },    // Confirmed – amber
  processing: { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },   // Processing – yellow
  shipped: { bg: "#E0F2FE", text: "#0C4A6E", dot: "#0EA5E9" },      // Shipped – sky
  delivered: { bg: "#DCFCE7", text: "#14532D", dot: "#16A34A" },    // Delivered – green
  cancelled: { bg: "#FEE2E2", text: "#7F1D1D", dot: "#EF4444" },    // Cancelled – red
};

export const statusColorsDark = {
  pending: { bg: "#1E3A5F", text: "#93C5FD", dot: "#3B82F6" },
  confirmed: { bg: "#3B2D04", text: "#FDE047", dot: "#EAB308" },
  processing: { bg: "#3B2E04", text: "#FCD34D", dot: "#F59E0B" },
  shipped: { bg: "#0C2535", text: "#7DD3FC", dot: "#0EA5E9" },
  delivered: { bg: "#052E16", text: "#86EFAC", dot: "#22C55E" },
  cancelled: { bg: "#3B0D0D", text: "#FCA5A5", dot: "#EF4444" },
};

// ─── Color palette ────────────────────────────────────────────────────────────
export const palette = {
  light: {
    background: "#F9FAFB",
    surface: "#FFFFFF",
    surfaceAlt: "#F3F4F6",
    text: "#111827",
    mutedText: "#6B7280",
    subtleText: "#9CA3AF",
    primary: brand.green,
    primaryLight: brand.greenLight,
    primaryDark: brand.greenDark,
    border: "#E5E7EB",
    borderStrong: "#D1D5DB",
    danger: "#DC2626",
    dangerLight: "#FEE2E2",
    warning: "#D97706",
    warningLight: "#FEF3C7",
    success: brand.green,
    successLight: brand.greenLight,
    // tab bar
    tabActive: brand.green,
    tabInactive: "#9CA3AF",
    tabBar: "#FFFFFF",
    // overlay
    overlay: "rgba(0,0,0,0.4)",
    // shadow (iOS)
    shadow: "#000000",
  },
  dark: {
    background: "#0B1120",
    surface: "#111827",
    surfaceAlt: "#1F2937",
    text: "#F9FAFB",
    mutedText: "#9CA3AF",
    subtleText: "#6B7280",
    primary: "#22C55E",
    primaryLight: "#052E16",
    primaryDark: "#16A34A",
    border: "#1F2937",
    borderStrong: "#374151",
    danger: "#F87171",
    dangerLight: "#3B0D0D",
    warning: "#FBBF24",
    warningLight: "#3B2B04",
    success: "#22C55E",
    successLight: "#052E16",
    tabActive: "#22C55E",
    tabInactive: "#6B7280",
    tabBar: "#111827",
    overlay: "rgba(0,0,0,0.65)",
    shadow: "#000000",
  },
};

export type ThemeColors = typeof palette.light;

// ─── Spacing scale (8px base) ─────────────────────────────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 80,
} as const;

// ─── Radius scale ─────────────────────────────────────────────────────────────
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

// ─── Typography scale ─────────────────────────────────────────────────────────
export const typography = {
  displayLg: { fontSize: 28, fontWeight: "800" as const, lineHeight: 34 },
  displayMd: { fontSize: 24, fontWeight: "700" as const, lineHeight: 30 },
  headingLg: { fontSize: 20, fontWeight: "700" as const, lineHeight: 26 },
  headingMd: { fontSize: 17, fontWeight: "600" as const, lineHeight: 22 },
  headingSm: { fontSize: 15, fontWeight: "600" as const, lineHeight: 20 },
  bodyLg: { fontSize: 16, fontWeight: "400" as const, lineHeight: 22 },
  bodyMd: { fontSize: 14, fontWeight: "400" as const, lineHeight: 20 },
  bodySm: { fontSize: 13, fontWeight: "400" as const, lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: "400" as const, lineHeight: 16 },
  label: { fontSize: 11, fontWeight: "600" as const, lineHeight: 14, letterSpacing: 0.5 },
} as const;

// ─── Shadow presets ───────────────────────────────────────────────────────────
export const shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? palette.dark : palette.light;
}

export function useStatusColors() {
  const scheme = useColorScheme();
  return scheme === "dark" ? statusColorsDark : statusColors;
}
