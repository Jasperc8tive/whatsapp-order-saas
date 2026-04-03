import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { ScreenContainer } from "../components/ScreenContainer";
import { showSendError, showSuccess } from "../lib/alertHelpers";
import { ALERT_TITLES } from "../lib/alertTitles";
import { useThemeColors } from "../lib/theme";
import type { AuthStackParamList } from "../navigation/AuthStack";
import { authService } from "../services/authService";

type Props = NativeStackScreenProps<AuthStackParamList, "PasswordReset">;

export function PasswordResetScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    try {
      setLoading(true);
      await authService.resetPassword(email.trim());
      showSuccess(ALERT_TITLES.success.checkInbox, "Check your email for the password reset link.");
      navigation.goBack();
    } catch (error) {
      showSendError(ALERT_TITLES.error.unableToSendResetLink, error, "Unable to send a reset link right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <Text style={[styles.title, { color: colors.text }]}>Reset password</Text>
      <AppInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <AppButton title={loading ? "Sending..." : "Send reset link"} onPress={onSubmit} disabled={loading} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
});
