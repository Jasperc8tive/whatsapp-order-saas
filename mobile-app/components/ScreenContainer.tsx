import { Feather } from "@expo/vector-icons";
import React, { type PropsWithChildren } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView as SafeAreaViewContext } from "react-native-safe-area-context";

import { radius, shadows, spacing, typography, useThemeColors } from "../lib/theme";

interface ScreenContainerProps extends PropsWithChildren {
  scroll?: boolean;
  /** Page heading shown in a top header bar */
  title?: string;
  /** Optional right action button config */
  headerRight?: { icon: keyof typeof Feather.glyphMap; onPress: () => void; label?: string };
  /** Remove horizontal padding (e.g. for full-bleed lists) */
  noPadding?: boolean;
}

export function ScreenContainer({
  children,
  scroll = true,
  title,
  headerRight,
  noPadding = false,
}: ScreenContainerProps) {
  const colors = useThemeColors();

  const content = (
    <>
      {title && (
        <View
          style={[
            styles.header,
            shadows.sm,
            { backgroundColor: colors.surface, borderBottomColor: colors.border },
          ]}
        >
          <Text style={[typography.headingLg, { color: colors.text, flex: 1 }]}>{title}</Text>
          {headerRight && (
            <Pressable
              onPress={headerRight.onPress}
              style={({ pressed }) => [
                styles.headerBtn,
                { backgroundColor: colors.primaryLight, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name={headerRight.icon} size={18} color={colors.primary} />
              {headerRight.label && (
                <Text style={[typography.headingSm, { color: colors.primary, marginLeft: 4 }]}>
                  {headerRight.label}
                </Text>
              )}
            </Pressable>
          )}
        </View>
      )}
      <View style={[!noPadding && styles.bodyPad]}>{children}</View>
    </>
  );

  return (
    <SafeAreaViewContext style={[styles.safe, { backgroundColor: colors.background }]}>
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={styles.fill}>{content}</View>
      )}
    </SafeAreaViewContext>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fill: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    marginBottom: spacing.sm,
  },
  headerBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
  },
  bodyPad: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  scrollContent: {
    gap: 0,
  },
});

