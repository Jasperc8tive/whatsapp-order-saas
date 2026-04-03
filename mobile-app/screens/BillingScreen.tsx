import * as Linking from "expo-linking";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "../components/AppButton";
import { ScreenContainer } from "../components/ScreenContainer";
import { showStartError, showSuccess } from "../lib/alertHelpers";
import { ALERT_TITLES } from "../lib/alertTitles";
import { formatCurrency } from "../lib/format";
import { useThemeColors } from "../lib/theme";
import { billingService } from "../services/billingService";
import type { PlanId } from "../types/domain";

const plans: Array<{ id: PlanId; price: number; title: string; cap: string }> = [
  { id: "starter", price: 0, title: "Starter", cap: "50 orders/month" },
  { id: "growth", price: 9900, title: "Growth", cap: "200 orders/month" },
  { id: "pro", price: 24900, title: "Pro", cap: "Unlimited + AI" },
];

const upgradePlans: Array<{ id: Exclude<PlanId, "starter">; title: string }> = [
  { id: "growth", title: "Growth" },
  { id: "pro", title: "Pro" },
];

export function BillingScreen() {
  const colors = useThemeColors();
  const [currentPlan, setCurrentPlan] = useState<PlanId>("starter");

  useEffect(() => {
    billingService
      .getCurrentSubscription()
      .then((data) => setCurrentPlan(data.plan))
      .catch(() => setCurrentPlan("starter"));
  }, []);

  const upgrade = async (plan: Exclude<PlanId, "starter">) => {
    try {
      const response = await billingService.initializeUpgrade(plan);
      if (response.authorizationUrl) {
        await Linking.openURL(response.authorizationUrl);
      } else {
        showSuccess(ALERT_TITLES.success.continueOnWeb, "Continue payment on web checkout.");
      }
    } catch (error) {
      showStartError(ALERT_TITLES.error.unableToStartUpgrade, error, "Unable to start your upgrade right now.");
    }
  };

  return (
    <ScreenContainer>
      <Text style={[styles.title, { color: colors.text }]}>Billing plans</Text>
      <Text style={{ color: colors.mutedText }}>Current plan: {currentPlan}</Text>
      {plans.map((plan) => (
        <View key={plan.id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.name, { color: colors.text }]}>{plan.title}</Text>
          <Text style={{ color: colors.mutedText }}>{formatCurrency(plan.price)} / month</Text>
          <Text style={{ color: colors.mutedText }}>{plan.cap}</Text>
          {upgradePlans
            .filter((item) => item.id === plan.id)
            .map((item) => (
              <AppButton
                key={item.id}
                title={`Upgrade to ${item.title}`}
                onPress={() => upgrade(item.id)}
              />
            ))}
        </View>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "700" },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  name: {
    fontSize: 17,
    fontWeight: "700",
  },
});
