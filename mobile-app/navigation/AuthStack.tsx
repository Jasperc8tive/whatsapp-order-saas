import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";

import { LoginScreen } from "../screens/LoginScreen";
import { PasswordResetScreen } from "../screens/PasswordResetScreen";
import { SignupScreen } from "../screens/SignupScreen";

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  PasswordReset: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Login" }} />
      <Stack.Screen name="Signup" component={SignupScreen} options={{ title: "Create account" }} />
      <Stack.Screen name="PasswordReset" component={PasswordResetScreen} options={{ title: "Password reset" }} />
    </Stack.Navigator>
  );
}
