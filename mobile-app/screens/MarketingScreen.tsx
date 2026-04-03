import React, { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { ScreenContainer } from "../components/ScreenContainer";
import { showSendError, showSuccess } from "../lib/alertHelpers";
import { ALERT_TITLES } from "../lib/alertTitles";
import { ENV } from "../lib/env";
import { useThemeColors } from "../lib/theme";
import type { RootStackParamList } from "../navigation/types";
import { marketingService, type CampaignResponse, type Segment } from "../services/marketingService";
import { settingsService } from "../services/settingsService";

export function MarketingScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [message, setMessage] = useState("Hi there. We have a discount today. Place your order now.");
  const [slug, setSlug] = useState("");
  const [segment, setSegment] = useState<Segment>("all_customers");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CampaignResponse | null>(null);

  useEffect(() => {
    settingsService.getProfile().then((profile) => setSlug(profile.slug ?? "")).catch(() => setSlug(""));
  }, []);

  const campaignMessage = `${message}\n${ENV.API_BASE_URL}/store/${slug}`;

  const sendCampaign = async () => {
    try {
      setLoading(true);
      const response = await marketingService.sendCampaign(campaignMessage, segment);
      setResult(response);
      showSuccess(
        ALERT_TITLES.success.sent,
        `Delivered to ${response.sent}/${response.recipientCount} recipients.`,
        [
          {
            text: "View history",
            onPress: () => navigation.navigate("CampaignHistory"),
          },
          {
            text: "Close",
            style: "cancel",
          },
        ]
      );
    } catch (error) {
      showSendError(ALERT_TITLES.error.unableToSendCampaign, error, "Unable to send this campaign right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <Text style={[styles.title, { color: colors.text }]}>Customer marketing</Text>
      <AppButton title="View campaign history" variant="secondary" onPress={() => navigation.navigate("CampaignHistory")} />
      <AppInput label="Promotion message" value={message} onChangeText={setMessage} multiline numberOfLines={4} />
      <Text style={{ color: colors.mutedText }}>Audience segment</Text>
      <AppButton
        title={`Segment: ${segment === "all_customers" ? "All customers" : "Repeat buyers"}`}
        variant="secondary"
        onPress={() => setSegment((prev) => (prev === "all_customers" ? "repeat_buyers" : "all_customers"))}
      />
      <Text style={{ color: colors.mutedText }}>Preview: {campaignMessage}</Text>
      <AppButton title={loading ? "Sending..." : "Send promotion"} onPress={sendCampaign} disabled={loading} />

      {result ? (
        <>
          <Text style={{ color: colors.text, fontWeight: "700" }}>Campaign report</Text>
          <Text style={{ color: colors.mutedText }}>Recipients: {result.recipientCount}</Text>
          <Text style={{ color: colors.mutedText }}>Sent: {result.sent}</Text>
          <Text style={{ color: colors.mutedText }}>Failed: {result.failed}</Text>
          <Text style={{ color: colors.text, fontWeight: "700", marginTop: 8 }}>Delivery status snapshot</Text>
          {Object.entries(result.deliveryStatusReport).map(([status, count]) => (
            <Text key={status} style={{ color: colors.mutedText }}>
              {status}: {count}
            </Text>
          ))}
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
});
