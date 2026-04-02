import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { ScreenContainer } from "../components/ScreenContainer";
import { formatCurrency } from "../lib/format";
import { useThemeColors } from "../lib/theme";
import { loyaltyService, type LoyaltyOverview } from "../services/loyaltyService";
import { settingsService } from "../services/settingsService";
import { workspaceService } from "../services/workspaceService";
import type { WorkspaceRole } from "../types/domain";

export function LoyaltyScreen() {
  const colors = useThemeColors();
  const [loading, setLoading] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [overview, setOverview] = useState<LoyaltyOverview | null>(null);
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [pointsPerOrderInput, setPointsPerOrderInput] = useState("10");
  const [rewardThresholdInput, setRewardThresholdInput] = useState("100");

  const load = async () => {
    setLoading(true);
    try {
      const [data, currentRole] = await Promise.all([
        loyaltyService.getOverview(),
        workspaceService.getCurrentRole(),
      ]);

      setOverview(data);
      setRole(currentRole);

      if (currentRole === "owner") {
        const profile = await settingsService.getProfile();
        setPointsPerOrderInput(String(Number(profile.loyalty_points_per_order ?? data.pointsPerOrder ?? 10)));
        setRewardThresholdInput(String(Number(profile.loyalty_reward_threshold ?? data.rewardThreshold ?? 100)));
      } else {
        setPointsPerOrderInput(String(Number(data.pointsPerOrder ?? 10)));
        setRewardThresholdInput(String(Number(data.rewardThreshold ?? 100)));
      }
    } catch (error) {
      Alert.alert("Failed to load loyalty", (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const saveRules = async () => {
    if (role !== "owner") {
      Alert.alert("Restricted", "Only workspace owners can edit loyalty rules.");
      return;
    }

    const pointsPerOrder = Math.floor(Number(pointsPerOrderInput));
    const rewardThreshold = Math.floor(Number(rewardThresholdInput));

    if (!Number.isFinite(pointsPerOrder) || pointsPerOrder <= 0) {
      Alert.alert("Invalid rule", "Points per order must be a positive integer.");
      return;
    }

    if (!Number.isFinite(rewardThreshold) || rewardThreshold <= 0) {
      Alert.alert("Invalid rule", "Reward threshold must be a positive integer.");
      return;
    }

    try {
      setSavingRules(true);
      await settingsService.updateProfile({
        loyalty_points_per_order: pointsPerOrder,
        loyalty_reward_threshold: rewardThreshold,
      });
      await load();
      Alert.alert("Saved", "Loyalty rules updated.");
    } catch (error) {
      Alert.alert("Save failed", (error as Error).message);
    } finally {
      setSavingRules(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  return (
    <ScreenContainer>
      <Text style={[styles.title, { color: colors.text }]}>Customer loyalty</Text>
      <Text style={{ color: colors.mutedText }}>
        Auto points model: {overview?.pointsPerOrder ?? 10} points/order • Reward every {overview?.rewardThreshold ?? 100} points
      </Text>
      {role === "owner" ? (
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
          <Text style={{ color: colors.text, fontWeight: "700" }}>Loyalty rules</Text>
          <AppInput
            label="Points per order"
            value={pointsPerOrderInput}
            onChangeText={setPointsPerOrderInput}
            keyboardType="numeric"
          />
          <AppInput
            label="Reward threshold"
            value={rewardThresholdInput}
            onChangeText={setRewardThresholdInput}
            keyboardType="numeric"
          />
          <AppButton
            title={savingRules ? "Saving..." : "Save loyalty rules"}
            variant="secondary"
            onPress={saveRules}
            disabled={savingRules || loading}
          />
        </View>
      ) : (
        <Text style={{ color: colors.mutedText }}>Only workspace owners can edit loyalty rules.</Text>
      )}
      <AppButton title={loading ? "Refreshing..." : "Refresh"} variant="secondary" onPress={load} disabled={loading} />

      {(overview?.members ?? []).slice(0, 20).map((member) => (
        <View key={member.id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
          <Text style={[styles.name, { color: colors.text }]}>{member.name}</Text>
          <Text style={{ color: colors.mutedText }}>
            Orders: {member.total_orders} • Spent: {formatCurrency(member.total_spent)}
          </Text>
          <Text style={{ color: colors.mutedText }}>
            Points: {member.points} • Rewards earned: {member.rewardUnits}
          </Text>
        </View>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
  },
});
