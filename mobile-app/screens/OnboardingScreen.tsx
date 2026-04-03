import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";

import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { ScreenContainer } from "../components/ScreenContainer";
import { showSaveError, showSuccess } from "../lib/alertHelpers";
import { ALERT_TITLES } from "../lib/alertTitles";
import { useThemeColors } from "../lib/theme";
import type { RootStackParamList } from "../navigation/types";
import { authService } from "../services/authService";

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

export function OnboardingScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const [businessName, setBusinessName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);

  const slug = useMemo(
    () =>
      businessName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 40),
    [businessName]
  );

  const onComplete = async () => {
    try {
      setLoading(true);
      await authService.saveOnboarding({ businessName, whatsappNumber, category, slug });
      showSuccess(ALERT_TITLES.success.saved, "Business profile is ready.");
      navigation.goBack();
    } catch (error) {
      showSaveError(ALERT_TITLES.error.unableToSaveProfile, error, "Unable to save your onboarding details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <Text style={[styles.title, { color: colors.text }]}>Business onboarding</Text>
      <AppInput label="Business name" value={businessName} onChangeText={setBusinessName} />
      <AppInput label="WhatsApp number" value={whatsappNumber} onChangeText={setWhatsappNumber} keyboardType="phone-pad" />
      <AppInput label="Business category" value={category} onChangeText={setCategory} />
      <AppInput label="Store slug" value={slug} editable={false} />
      <AppButton title={loading ? "Saving..." : "Save onboarding"} onPress={onComplete} disabled={loading} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
});
