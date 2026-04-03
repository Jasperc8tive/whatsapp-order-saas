import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "../components/AppButton";
import { ScreenContainer } from "../components/ScreenContainer";
import { showLoadError } from "../lib/alertHelpers";
import { ALERT_TITLES } from "../lib/alertTitles";
import { useThemeColors } from "../lib/theme";
import { marketingService, type CampaignHistoryItem } from "../services/marketingService";

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-NG", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CampaignHistoryScreen() {
  const colors = useThemeColors();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<CampaignHistoryItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await marketingService.listCampaignHistory(50);
      setRows(data);
    } catch (error) {
      showLoadError(ALERT_TITLES.error.unableToLoadCampaignHistory, error, "Unable to load campaign history right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return (
    <ScreenContainer>
      <Text style={[styles.title, { color: colors.text }]}>Campaign history</Text>
      <AppButton title={loading ? "Refreshing..." : "Refresh"} variant="secondary" onPress={load} disabled={loading} />

      <View style={[styles.tableHeader, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
        <Text style={[styles.headerCell, { color: colors.text, flex: 1.6 }]}>Date</Text>
        <Text style={[styles.headerCell, { color: colors.text, flex: 1.4 }]}>Segment</Text>
        <Text style={[styles.headerCell, { color: colors.text, flex: 1 }]}>Sent</Text>
        <Text style={[styles.headerCell, { color: colors.text, flex: 1 }]}>Failed</Text>
      </View>

      {rows.length === 0 ? (
        <Text style={{ color: colors.mutedText }}>{loading ? "Loading records..." : "No campaigns yet."}</Text>
      ) : (
        rows.map((row) => {
          const deliverySummary = Object.entries(row.delivery_status_report ?? {})
            .filter(([, count]) => Number(count) > 0)
            .map(([status, count]) => `${status}: ${count}`)
            .join(" | ");

          return (
            <View key={row.id} style={[styles.tableRow, { borderColor: colors.border }]}> 
              <View style={styles.rowTop}>
                <Text style={[styles.rowCell, { color: colors.text, flex: 1.6 }]}>{formatDate(row.created_at)}</Text>
                <Text style={[styles.rowCell, { color: colors.text, flex: 1.4 }]}>
                  {row.segment === "all_customers" ? "All customers" : "Repeat buyers"}
                </Text>
                <Text style={[styles.rowCell, { color: colors.text, flex: 1 }]}>{row.sent_count}</Text>
                <Text style={[styles.rowCell, { color: colors.text, flex: 1 }]}>{row.failed_count}</Text>
              </View>
              <Text style={{ color: colors.mutedText }} numberOfLines={2}>
                {row.message}
              </Text>
              <Text style={{ color: colors.mutedText }}>
                Recipients: {row.recipient_count} {deliverySummary ? `• ${deliverySummary}` : ""}
              </Text>
            </View>
          );
        })
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  tableHeader: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  headerCell: {
    fontSize: 12,
    fontWeight: "700",
  },
  tableRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 6,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowCell: {
    fontSize: 12,
    fontWeight: "600",
  },
});
