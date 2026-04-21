import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";

import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { ScreenContainer } from "../components/ScreenContainer";
import { useThemeColors } from "../lib/theme";
import type { AuthStackParamList } from "../navigation/AuthStack";
import { authService } from "../services/authService";

type Props = NativeStackScreenProps<AuthStackParamList, "Signup">;

export function SignupScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSignup = async () => {
    try {
      setLoading(true);
      await authService.signUp(email.trim(), password);
      Alert.alert("Account created", "Check your email if confirmation is enabled.");
      navigation.navigate("Login");
    } catch (error) {
      Alert.alert("Signup failed", (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <Text style={[styles.title, { color: colors.text }]}>Create business account</Text>
      <AppInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <AppInput label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <AppButton title={loading ? "Creating..." : "Sign up"} onPress={onSignup} disabled={loading} />
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
