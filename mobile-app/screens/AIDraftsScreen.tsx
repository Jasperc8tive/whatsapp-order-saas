import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View, Pressable } from "react-native";

import { EmptyState } from "../components/EmptyState";
import { ScreenContainer } from "../components/ScreenContainer";
import { formatDateTime } from "../lib/format";
import { radius, shadows, spacing, typography, useThemeColors } from "../lib/theme";
import { draftService } from "../services/draftService";
import type { OrderDraft } from "../types/domain";

export function AIDraftsScreen() {
  const colors = useThemeColors();
  const [drafts, setDrafts] = useState<OrderDraft[]>([]);

  const load = useCallback(async () => {
    const rows = await draftService.listDrafts();
    setDrafts(rows);
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const review = async (id: string, action: "approve" | "reject") => {
    await draftService.reviewDraft(id, action);
    await load();
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.85) return colors.success;
    if (confidence >= 0.6) return colors.warning;
    return colors.danger;
  };

  return (
    <ScreenContainer scroll={false} title="AI Order Drafts" noPadding>
      <FlatList
        data={drafts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="zap"
            title="No pending drafts"
            subtitle="WhatsApp messages parsed by AI will appear here for review."
          />
        }
        renderItem={({ item }) => {
          const confidence = item.confidence ?? 0;
          const confColor = getConfidenceColor(confidence);
          const isPending = item.status === "pending_review";

          return (
            <View
              style={[
                styles.card,
                shadows.sm,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {/* Message bubble */}
              <View style={[styles.bubble, { backgroundColor: colors.surfaceAlt }]}>
                <Feather name="message-square" size={13} color={colors.mutedText} style={{ marginRight: spacing.xs }} />
                <Text style={[typography.bodyMd, { color: colors.mutedText, flex: 1 }]} numberOfLines={2}>
                  {"Inbound message #" + (item.inbound_message_id?.slice(0, 8) ?? "unknown")}
                </Text>
              </View>

              {/* Arrow */}
              <View style={styles.arrowRow}>
                <View style={[styles.arrowLine, { backgroundColor: colors.border }]} />
                <View style={[styles.arrowHead, { borderLeftColor: colors.primary }]} />
                <Text style={[typography.caption, { color: colors.primary, marginLeft: spacing.sm }]}>
                  AI parsed
                </Text>
              </View>

              {/* Parsed result */}
              <View style={[styles.parsed, { backgroundColor: colors.primaryLight, borderColor: `${colors.primary}30` }]}>
                <Text style={[typography.headingSm, { color: colors.text, marginBottom: spacing.xs }]}>
                  {item.customer_name ?? item.customer_phone ?? "Unknown customer"}
                </Text>
                {item.items.map((row, i) => (
                  <Text key={i} style={[typography.bodyMd, { color: colors.text }]}>
                    {row.quantity}× {row.name}
                  </Text>
                ))}
              </View>

              {/* Meta row */}
              <View style={styles.metaRow}>
                <View style={[styles.confBadge, { backgroundColor: `${confColor}20` }]}>
                  <Feather name="cpu" size={11} color={confColor} />
                  <Text style={[typography.label, { color: confColor, marginLeft: 3 }]}>
                    {Math.round(confidence * 100)}% confidence
                  </Text>
                </View>
                <Text style={[typography.caption, { color: colors.subtleText }]}>
                  {formatDateTime(item.created_at)}
                </Text>
              </View>

              {/* Actions */}
              {isPending && (
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => review(item.id, "approve")}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      { backgroundColor: colors.primary, flex: 1, opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <Feather name="check" size={15} color="#fff" />
                    <Text style={[typography.headingSm, { color: "#fff", marginLeft: spacing.xs }]}>Confirm order</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => review(item.id, "reject")}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      { backgroundColor: colors.dangerLight, opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <Feather name="x" size={15} color={colors.danger} />
                  </Pressable>
                </View>
              )}

              {!isPending && (
                <Text style={[typography.caption, { color: colors.mutedText, textAlign: "center", marginTop: spacing.xs }]}>
                  {item.status === "approved" ? "✓ Confirmed" : "✗ Rejected"}
                </Text>
              )}
            </View>
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 80,
    gap: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
  },
  bubble: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  arrowRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: spacing.sm,
  },
  arrowLine: {
    height: 1.5,
    width: 24,
  },
  arrowHead: {
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderLeftWidth: 8,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
  parsed: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 3,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  confBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
});
