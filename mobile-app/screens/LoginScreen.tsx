import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { ScreenContainer } from "../components/ScreenContainer";
import { showErrorAlert } from "../lib/alertHelpers";
import { ALERT_TITLES } from "../lib/alertTitles";
import { useThemeColors } from "../lib/theme";
import type { AuthStackParamList } from "../navigation/AuthStack";
import { authService } from "../services/authService";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    try {
      setLoading(true);
      await authService.signIn(email.trim(), password);
    } catch (error) {
      showErrorAlert(ALERT_TITLES.error.unableToSignIn, error, "Unable to sign in right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
      <AppInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <AppInput label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <AppButton title={loading ? "Signing in..." : "Sign in"} onPress={onLogin} disabled={loading} />
      <AppButton title="Create account" variant="secondary" onPress={() => navigation.navigate("Signup")} />
      <AppButton title="Forgot password" variant="secondary" onPress={() => navigation.navigate("PasswordReset")} />
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
