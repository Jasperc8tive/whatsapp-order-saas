import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Linking from "expo-linking";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppInput } from "../components/AppInput";
import { Avatar } from "../components/Avatar";
import { SectionHeader } from "../components/SectionHeader";
import { StatusBadge } from "../components/StatusBadge";
import { formatCurrency, formatDateTime } from "../lib/format";
import { radius, shadows, spacing, typography, useThemeColors } from "../lib/theme";
import type { RootStackParamList } from "../navigation/types";
import { customerService } from "../services/customerService";
import { loyaltyService, type LoyaltyLedger } from "../services/loyaltyService";
import { supabase } from "../services/supabaseClient";
import type { Customer, Order } from "../types/domain";

type Props = NativeStackScreenProps<RootStackParamList, "CustomerProfile">;

export function CustomerProfileScreen({ route, navigation }: Props) {
  const colors = useThemeColors();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ledger, setLedger] = useState<LoyaltyLedger | null>(null);
  const [pointsInput, setPointsInput] = useState("10");
  const [reasonInput, setReasonInput] = useState("");

  useEffect(() => {
    const load = async () => {
      const customerResult = await supabase
        .from("customers")
        .select("id,vendor_id,name,phone,email,address,created_at,updated_at")
        .eq("id", route.params.customerId)
        .single();
      if (customerResult.data) setCustomer(customerResult.data as Customer);

      const orderResult = await supabase
        .from("orders")
        .select("id,order_status,total_amount,created_at")
        .eq("customer_id", route.params.customerId)
        .order("created_at", { ascending: false });

      setOrders((orderResult.data ?? []) as Order[]);

      try {
        const loyaltyLedger = await loyaltyService.getCustomerLedger(route.params.customerId, 10);
        setLedger(loyaltyLedger);
      } catch {
        setLedger(null);
      }
    };

    load().catch(() => undefined);
  }, [route.params.customerId]);

  const runLoyaltyAction = async (action: "bonus" | "redeem") => {
    const points = Math.floor(Number(pointsInput));
    if (!Number.isFinite(points) || points <= 0) {
      Alert.alert("Invalid points", "Enter a positive points value.");
      return;
    }

    try {
      if (action === "bonus") {
        await loyaltyService.awardBonus(route.params.customerId, points, reasonInput.trim() || undefined);
      } else {
        await loyaltyService.redeemReward(route.params.customerId, points, reasonInput.trim() || undefined);
      }

      const refreshed = await loyaltyService.getCustomerLedger(route.params.customerId, 10);
      setLedger(refreshed);
      setReasonInput("");
      Alert.alert("Updated", action === "bonus" ? "Bonus points added." : "Reward redeemed.");
    } catch (error) {
      Alert.alert("Loyalty update failed", (error as Error).message);
    }
  };

  const deleteCustomer = () => {
    Alert.alert("Delete customer", "This will remove the customer record.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await customerService.deleteCustomer(route.params.customerId);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Hero ── */}
        <View style={[styles.hero, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          {customer && <Avatar name={customer.name} size={72} />}
          <View style={styles.heroInfo}>
            <Text style={[typography.headingLg, { color: colors.text }]}>{customer?.name ?? "Loading…"}</Text>
            <Text style={[typography.bodyMd, { color: colors.mutedText }]}>{customer?.phone}</Text>
            {customer?.email && (
              <Text style={[typography.bodySm, { color: colors.subtleText }]}>{customer.email}</Text>
            )}
          </View>
          {/* Quick contact actions */}
          {customer && (
            <View style={styles.heroActions}>
              <Pressable
                onPress={() => Linking.openURL(`https://wa.me/${customer.phone.replace(/\D/g, "")}`)}
                style={[styles.heroBtn, { backgroundColor: "#DCFCE7" }]}
              >
                <Feather name="message-circle" size={20} color="#16A34A" />
              </Pressable>
              <Pressable
                onPress={() => Linking.openURL(`tel:${customer.phone}`)}
                style={[styles.heroBtn, { backgroundColor: colors.surfaceAlt }]}
              >
                <Feather name="phone" size={20} color={colors.mutedText} />
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate("CustomerForm", { customerId: route.params.customerId })}
                style={[styles.heroBtn, { backgroundColor: colors.primaryLight }]}
              >
                <Feather name="edit-2" size={18} color={colors.primary} />
              </Pressable>
            </View>
          )}
        </View>

        {/* ── Stats row ── */}
        {customer && (
          <View style={[styles.statsRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <View style={styles.statItem}>
              <Text style={[typography.displayMd, { color: colors.primary }]}>{orders.length}</Text>
              <Text style={[typography.caption, { color: colors.mutedText }]}>Orders</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[typography.displayMd, { color: colors.primary }]}>
                {formatCurrency(orders.reduce((acc, o) => acc + Number(o.total_amount ?? 0), 0))}
              </Text>
              <Text style={[typography.caption, { color: colors.mutedText }]}>Total spent</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[typography.displayMd, { color: colors.primary }]}>{ledger?.balance ?? 0}</Text>
              <Text style={[typography.caption, { color: colors.mutedText }]}>Points</Text>
            </View>
          </View>
        )}

        <View style={styles.body}>
          {/* ── Loyalty section ── */}
          <View style={[styles.card, shadows.sm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SectionHeader title="Loyalty points" />
            <AppInput
              label="Points amount"
              value={pointsInput}
              onChangeText={setPointsInput}
              keyboardType="numeric"
              icon="star"
            />
            <AppInput
              label="Reason (optional)"
              value={reasonInput}
              onChangeText={setReasonInput}
              icon="edit"
            />
            <View style={styles.loyaltyBtns}>
              <Pressable
                onPress={() => runLoyaltyAction("bonus")}
                style={[styles.loyaltyBtn, { backgroundColor: colors.primaryLight, flex: 1 }]}
              >
                <Feather name="plus" size={15} color={colors.primary} />
                <Text style={[typography.headingSm, { color: colors.primary, marginLeft: 5 }]}>Add bonus</Text>
              </Pressable>
              <Pressable
                onPress={() => runLoyaltyAction("redeem")}
                style={[styles.loyaltyBtn, { backgroundColor: colors.warningLight, flex: 1 }]}
              >
                <Feather name="gift" size={15} color={colors.warning} />
                <Text style={[typography.headingSm, { color: colors.warning, marginLeft: 5 }]}>Redeem</Text>
              </Pressable>
            </View>

            {(ledger?.transactions ?? []).length > 0 && (
              <View style={[styles.ledger, { borderTopColor: colors.border }]}>
                <Text style={[typography.headingSm, { color: colors.text, marginBottom: spacing.sm }]}>Recent transactions</Text>
                {(ledger?.transactions ?? []).slice(0, 5).map((entry) => (
                  <View key={entry.id} style={styles.ledgerRow}>
                    <Text
                      style={[
                        typography.headingSm,
                        { color: entry.points > 0 ? colors.success : colors.danger },
                      ]}
                    >
                      {entry.points > 0 ? "+" : ""}{entry.points}
                    </Text>
                    <Text style={[typography.bodyMd, { color: colors.mutedText, flex: 1, marginLeft: spacing.sm }]} numberOfLines={1}>
                      {entry.reason ?? "—"}
                    </Text>
                    <Text style={[typography.caption, { color: colors.subtleText }]}>
                      {formatDateTime(entry.created_at)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ── Order history ── */}
          <SectionHeader title="Order history" marginTop={spacing.lg} />
          {orders.length === 0 ? (
            <Text style={[typography.bodyMd, { color: colors.mutedText, textAlign: "center", paddingVertical: spacing.lg }]}>
              No orders yet
            </Text>
          ) : (
            orders.map((order) => (
              <View
                key={order.id}
                style={[styles.orderRow, shadows.sm, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.orderInfo}>
                  <Text style={[typography.headingSm, { color: colors.text }]}>
                    #{order.id.slice(0, 8)}
                  </Text>
                  <Text style={[typography.caption, { color: colors.mutedText }]}>
                    {formatDateTime(order.created_at)}
                  </Text>
                </View>
                <View style={styles.orderRight}>
                  <Text style={[typography.headingMd, { color: colors.text }]}>
                    {formatCurrency(Number(order.total_amount))}
                  </Text>
                  <StatusBadge status={order.order_status} size="sm" />
                </View>
              </View>
            ))
          )}

          {/* ── Danger zone ── */}
          <Pressable
            onPress={deleteCustomer}
            style={[styles.deleteBtn, { borderColor: colors.danger }]}
          >
            <Feather name="trash-2" size={15} color={colors.danger} />
            <Text style={[typography.headingSm, { color: colors.danger, marginLeft: spacing.xs }]}>
              Delete customer
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  heroInfo: { flex: 1 },
  heroActions: { flexDirection: "row", gap: spacing.xs },
  heroBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingVertical: spacing.md,
  },
  statItem: { flex: 1, alignItems: "center" },
  statDivider: { width: 1 },
  body: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
  },
  loyaltyBtns: { flexDirection: "row", gap: spacing.sm },
  loyaltyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  ledger: {
    borderTopWidth: 1,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  ledgerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  orderInfo: { gap: 2 },
  orderRight: { alignItems: "flex-end", gap: spacing.xs },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    borderRadius: radius.md,
    marginTop: spacing.lg,
  },
});

