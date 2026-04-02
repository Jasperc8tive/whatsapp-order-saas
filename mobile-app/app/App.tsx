import * as Sentry from "@sentry/react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AppProvider } from "../context/AppContext";
import { ENV } from "../lib/env";
import { useThemeColors } from "../lib/theme";
import { useBootstrapSession } from "../hooks/useBootstrapSession";
import { AuthStack } from "../navigation/AuthStack";
import { MainTabs } from "../navigation/MainTabs";
import type { RootStackParamList } from "../navigation/types";
import { AIDraftsScreen } from "../screens/AIDraftsScreen";
import { AnalyticsScreen } from "../screens/AnalyticsScreen";
import { BillingScreen } from "../screens/BillingScreen";
import { CampaignHistoryScreen } from "../screens/CampaignHistoryScreen";
import { CustomerFormScreen } from "../screens/CustomerFormScreen";
import { CustomerProfileScreen } from "../screens/CustomerProfileScreen";
import { InventoryScreen } from "../screens/InventoryScreen";
import { LoyaltyScreen } from "../screens/LoyaltyScreen";
import { MarketingScreen } from "../screens/MarketingScreen";
import { MarketplaceScreen } from "../screens/MarketplaceScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { OrderDetailsScreen } from "../screens/OrderDetailsScreen";
import { ProductFormScreen } from "../screens/ProductFormScreen";
import { TeamManagementScreen } from "../screens/TeamManagementScreen";
import { VoiceCaptureScreen } from "../screens/VoiceCaptureScreen";
import { useAuthStore } from "../store/authStore";

if (ENV.SENTRY_DSN) {
  Sentry.init({
    dsn: ENV.SENTRY_DSN,
    tracesSampleRate: 0.2,
  });
}

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppShell() {
  const colors = useThemeColors();
  const loading = useAuthStore((state) => state.loading);
  const user = useAuthStore((state) => state.user);

  useBootstrapSession();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 8, color: colors.mutedText }}>Loading workspace...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ title: "Onboarding" }} />
            <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} options={{ title: "Order details" }} />
            <Stack.Screen name="CustomerProfile" component={CustomerProfileScreen} options={{ title: "Customer profile" }} />
            <Stack.Screen name="CustomerForm" component={CustomerFormScreen} options={{ title: "Customer" }} />
            <Stack.Screen name="ProductForm" component={ProductFormScreen} options={{ title: "Product" }} />
            <Stack.Screen name="TeamManagement" component={TeamManagementScreen} options={{ title: "Team" }} />
            <Stack.Screen name="Billing" component={BillingScreen} options={{ title: "Billing" }} />
            <Stack.Screen name="AIDrafts" component={AIDraftsScreen} options={{ title: "AI drafts" }} />
            <Stack.Screen name="Analytics" component={AnalyticsScreen} options={{ title: "Analytics" }} />
            <Stack.Screen name="Marketing" component={MarketingScreen} options={{ title: "Marketing" }} />
            <Stack.Screen name="CampaignHistory" component={CampaignHistoryScreen} options={{ title: "Campaign history" }} />
            <Stack.Screen name="Inventory" component={InventoryScreen} options={{ title: "Inventory" }} />
            <Stack.Screen name="Loyalty" component={LoyaltyScreen} options={{ title: "Loyalty" }} />
            <Stack.Screen name="Marketplace" component={MarketplaceScreen} options={{ title: "Marketplace" }} />
            <Stack.Screen name="VoiceCapture" component={VoiceCaptureScreen} options={{ title: "Voice capture" }} />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthStack} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <AppShell />
      </AppProvider>
    </GestureHandlerRootView>
  );
}
