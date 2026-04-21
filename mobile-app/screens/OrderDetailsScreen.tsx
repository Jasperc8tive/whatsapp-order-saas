import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Linking from "expo-linking";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "../components/Avatar";
import { StatusBadge } from "../components/StatusBadge";
import { SectionHeader } from "../components/SectionHeader";
import { formatCurrency, formatDateTime } from "../lib/format";
import { radius, shadows, spacing, typography, useThemeColors } from "../lib/theme";
import type { RootStackParamList } from "../navigation/types";
import { apiRequest } from "../services/apiClient";
import { orderService } from "../services/orderService";
import type { Order, OrderStatus } from "../types/domain";

type Props = NativeStackScreenProps<RootStackParamList, "OrderDetails">;

const STATUS_FLOW: OrderStatus[] = ["pending", "confirmed", "processing", "shipped", "delivered"];

export function OrderDetailsScreen({ route, navigation }: Props) {
  const colors = useThemeColors();
  const [order, setOrder] = useState<Order | null>(null);

  const load = useCallback(async () => {
    const data = await orderService.getOrderById(route.params.orderId);
    setOrder(data);
  }, [route.params.orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const advanceStatus = async () => {
    if (!order) return;
    const curr = STATUS_FLOW.indexOf(order.order_status);
    const next = STATUS_FLOW[Math.min(curr + 1, STATUS_FLOW.length - 1)];
    if (next === order.order_status) return;
    await orderService.updateOrderStatus(order.id, next);
    await load();
  };

  const assignDelivery = async () => {
    try {
      await apiRequest("/api/orders", {
        method: "PATCH",
        body: JSON.stringify({ orderId: route.params.orderId, action: "assign_delivery" }),
      });
      Alert.alert("Assigned", "Order assigned for delivery queue.");
    } catch (error) {
      Alert.alert("Failed", (error as Error).message);
    }
  };

  const sendWhatsApp = async () => {
    if (!order?.customers?.phone) return;
    const message = encodeURIComponent(`Hi ${order.customers.name ?? ""}, your order is being processed!`);
    const url = `https://wa.me/${order.customers.phone.replace(/\D/g, "")}?text=${message}`;
    await Linking.openURL(url);
  };

  const generatePaymentLink = async () => {
    if (!order?.customers?.email) {
      Alert.alert("Missing email", "Customer email is required to generate a Paystack payment link.");
      return;
    }

    try {
      const callbackUrl = "https://whatsorder.app/pay/callback";
      const response = await apiRequest<{ authorization_url: string; reference: string }>("/api/paystack/initialize", {
        method: "POST",
        body: JSON.stringify({
          order_id: order.id,
          email: order.customers.email,
          callback_url: callbackUrl,
        }),
      });

      await Share.share({
        message: `Pay for order #${order.id.slice(0, 8)}: ${response.authorization_url}`,
      });
    } catch (error) {
      Alert.alert("Payment link failed", (error as Error).message);
    }
  };

  if (!order) {
    return (
      <SafeAreaView style={[{ flex: 1, backgroundColor: colors.background }]}>
        <View style={styles.loading}>
          <Text style={[typography.bodyMd, { color: colors.mutedText }]}>Loading order…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const customerName = order.customers?.name ?? "Unknown customer";
  const currStatusIdx = STATUS_FLOW.indexOf(order.order_status);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Header ── */}
        <View style={[styles.header, shadows.sm, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { backgroundColor: colors.surfaceAlt }]}
          >
            <Feather name="arrow-left" size={20} color={colors.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[typography.headingLg, { color: colors.text }]}>
              Order #{order.id.slice(0, 8)}
            </Text>
            <Text style={[typography.caption, { color: colors.mutedText }]}>
              {formatDateTime(order.created_at)}
            </Text>
          </View>
          <StatusBadge status={order.order_status} />
        </View>

        {/* ── Status stepper ── */}
        <View style={[styles.stepperCard, shadows.sm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.stepper}>
            {STATUS_FLOW.filter((s) => s !== "cancelled").map((step, idx) => {
              const isComplete = idx < currStatusIdx;
              const isActive = idx === currStatusIdx;
              return (
                <React.Fragment key={step}>
                  <View style={styles.stepItem}>
                    <View
                      style={[
                        styles.stepDot,
                        {
                          backgroundColor: isComplete || isActive ? colors.primary : colors.border,
                          borderColor: isActive ? colors.primary : "transparent",
                          borderWidth: isActive ? 3 : 0,
                        },
                      ]}
                    >
                      {isComplete && <Feather name="check" size={9} color="#fff" />}
                    </View>
                    <Text
                      style={[
                        typography.caption,
                        {
                          color: isActive ? colors.primary : isComplete ? colors.success : colors.subtleText,
                          fontWeight: isActive ? "700" : "400",
                        },
                      ]}
                    >
                      {step.charAt(0).toUpperCase() + step.slice(1)}
                    </Text>
                  </View>
                  {idx < STATUS_FLOW.filter((s) => s !== "cancelled").length - 1 && (
                    <View style={[styles.stepLine, { backgroundColor: idx < currStatusIdx ? colors.primary : colors.border }]} />
                  )}
                </React.Fragment>
              );
            })}
          </View>
          {order.order_status !== "delivered" && (
            <Pressable
              onPress={advanceStatus}
              style={({ pressed }) => [
                styles.advanceBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Feather name="arrow-right" size={14} color="#fff" />
              <Text style={[typography.headingSm, { color: "#fff", marginLeft: spacing.xs }]}>
                Advance status
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.body}>
          {/* ── Customer ── */}
          <View style={[styles.card, shadows.sm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SectionHeader title="Customer" />
            <View style={styles.customerRow}>
              <Avatar name={customerName} size={48} />
              <View style={styles.customerInfo}>
                <Text style={[typography.headingMd, { color: colors.text }]}>{customerName}</Text>
                <Text style={[typography.bodyMd, { color: colors.mutedText }]}>{order.customers?.phone ?? "—"}</Text>
                {order.customers?.address && (
                  <Text style={[typography.bodySm, { color: colors.subtleText }]}>{order.customers.address}</Text>
                )}
              </View>
              <View style={styles.contactBtns}>
                <Pressable
                  onPress={sendWhatsApp}
                  style={[styles.contactBtn, { backgroundColor: "#DCFCE7" }]}
                >
                  <Feather name="message-circle" size={18} color="#16A34A" />
                </Pressable>
                {order.customers?.phone && (
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${order.customers?.phone}`)}
                    style={[styles.contactBtn, { backgroundColor: colors.surfaceAlt }]}
                  >
                    <Feather name="phone" size={18} color={colors.mutedText} />
                  </Pressable>
                )}
              </View>
            </View>
          </View>

          {/* ── Items ── */}
          <View style={[styles.card, shadows.sm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SectionHeader title="Items" />
            {(order.order_items ?? []).map((item, idx) => (
              <View
                key={item.id}
                style={[
                  styles.itemRow,
                  idx < (order.order_items?.length ?? 0) - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
              >
                <View style={[styles.qty, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[typography.headingSm, { color: colors.primary }]}>{item.quantity}×</Text>
                </View>
                <Text style={[typography.bodyMd, { color: colors.text, flex: 1 }]}>{item.product_name}</Text>
                <Text style={[typography.headingSm, { color: colors.text }]}>
                  {formatCurrency(item.price * item.quantity)}
                </Text>
              </View>
            ))}
            <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
              <Text style={[typography.headingMd, { color: colors.mutedText }]}>Total</Text>
              <Text style={[typography.headingLg, { color: colors.text }]}>
                {formatCurrency(Number(order.total_amount))}
              </Text>
            </View>
          </View>

          {/* ── Payment ── */}
          <View style={[styles.card, shadows.sm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SectionHeader title="Payment" />
            <View style={styles.payRow}>
              <StatusBadge status={order.payment_status} type="payment" />
              <Text style={[typography.bodyMd, { color: colors.mutedText }]}>
                {order.payment_status === "unpaid" ? "Not yet paid" : order.payment_status}
              </Text>
            </View>
          </View>

          {/* ── Actions ── */}
          <View style={styles.actions}>
            <Pressable
              onPress={assignDelivery}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: colors.primary, flex: 1, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Feather name="truck" size={16} color="#fff" />
              <Text style={[typography.headingSm, { color: "#fff", marginLeft: spacing.xs }]}>
                Assign delivery
              </Text>
            </Pressable>
            <Pressable
              onPress={generatePaymentLink}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: colors.primaryLight, flex: 1, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Feather name="link" size={16} color={colors.primary} />
              <Text style={[typography.headingSm, { color: colors.primary, marginLeft: spacing.xs }]}>
                Payment link
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  stepperCard: {
    margin: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  stepItem: {
    alignItems: "center",
    gap: spacing.xs,
  },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginTop: 9,
    marginHorizontal: 4,
  },
  advanceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
  },
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  customerInfo: { flex: 1 },
  contactBtns: { flexDirection: "row", gap: spacing.xs },
  contactBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  qty: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    minWidth: 36,
    alignItems: "center",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    marginTop: spacing.xs,
  },
  payRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
});
