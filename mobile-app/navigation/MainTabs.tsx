import { Feather } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";
import { View, StyleSheet } from "react-native";
import { useColorScheme } from "react-native";

import type { MainTabParamList } from "./types";
import { CustomersScreen } from "../screens/CustomersScreen";
import { DeliveryScreen } from "../screens/DeliveryScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { OrdersScreen } from "../screens/OrdersScreen";
import { ProductsScreen } from "../screens/ProductsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { palette, radius, spacing, typography } from "../lib/theme";
import { useOrderStore } from "../store/orderStore";

const Tab = createBottomTabNavigator<MainTabParamList>();

type FeatherIcon = keyof typeof Feather.glyphMap;

const TAB_ICONS: Record<keyof MainTabParamList, FeatherIcon> = {
  Home: "home",
  Orders: "shopping-bag",
  Customers: "users",
  Products: "package",
  Delivery: "truck",
  Settings: "more-horizontal",
};

export function MainTabs() {
  const scheme = useColorScheme();
  const colors = scheme === "dark" ? palette.dark : palette.light;
  const pendingCount = useOrderStore((state) =>
    state.orders.filter((o) => o.order_status === "pending").length
  );

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: spacing.xs,
          paddingBottom: spacing.sm,
          height: 62,
        },
        tabBarLabelStyle: {
          ...typography.caption,
          marginTop: 2,
        },
        tabBarIcon: ({ color, size, focused }) => {
          const iconName = TAB_ICONS[route.name as keyof MainTabParamList];
          return (
            <View style={focused ? [styles.activeIndicator, { backgroundColor: `${colors.tabActive}18` }] : styles.inactiveIndicator}>
              <Feather name={iconName} size={focused ? 21 : 20} color={color} />
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: "Home" }} />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          tabBarLabel: "Orders",
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.primary,
            color: "#fff",
            fontSize: 10,
          },
        }}
      />
      <Tab.Screen name="Customers" component={CustomersScreen} options={{ tabBarLabel: "Customers" }} />
      <Tab.Screen name="Products" component={ProductsScreen} options={{ tabBarLabel: "Products" }} />
      <Tab.Screen name="Delivery" component={DeliveryScreen} options={{ tabBarLabel: "Delivery" }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: "More" }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  activeIndicator: {
    width: 40,
    height: 28,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  inactiveIndicator: {
    width: 40,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});

