import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppButton } from "../components/AppButton";
import { Avatar } from "../components/Avatar";
import { ENV } from "../lib/env";
import { radius, shadows, spacing, typography, useThemeColors } from "../lib/theme";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";
import { settingsService } from "../services/settingsService";
import { useAuthStore } from "../store/authStore";

type Props = BottomTabScreenProps<MainTabParamList, "Settings">;

type NavScreen = keyof RootStackParamList;

interface MenuItem {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  screen: NavScreen;
  badge?: string;
}

const MENU_GROUPS: Array<{ title: string; items: MenuItem[] }> = [
  {
    title: "Business",
    items: [
      { icon: "bar-chart-2", label: "Analytics", screen: "Analytics" },
      { icon: "layers", label: "Inventory", screen: "Inventory" },
      { icon: "star", label: "Loyalty program", screen: "Loyalty" },
      { icon: "shopping-bag", label: "Marketplace", screen: "Marketplace" },
    ],
  },
  {
    title: "Growth",
    items: [
      { icon: "send", label: "Marketing", screen: "Marketing" },
      { icon: "clock", label: "Campaign history", screen: "CampaignHistory" },
      { icon: "mic", label: "Voice capture", screen: "VoiceCapture" },
      { icon: "zap", label: "AI drafts", screen: "AIDrafts" },
    ],
  },
  {
    title: "Account",
    items: [
      { icon: "users", label: "Team management", screen: "TeamManagement" },
      { icon: "credit-card", label: "Billing & plan", screen: "Billing" },
    ],
  },
];

export function SettingsScreen(_: Props) {
  const colors = useThemeColors();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const signOut = useAuthStore((state) => state.signOut);
  const user = useAuthStore((state) => state.user);
  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [saving, setSaving] = useState(false);

  const storeLink = useMemo(() => `${ENV.API_BASE_URL}/store/${slug}`, [slug]);

  const load = useCallback(async () => {
    const profile = await settingsService.getProfile();
    setBusinessName(profile.business_name);
    setSlug(profile.slug ?? "");
    setWhatsapp(profile.whatsapp_number ?? "");
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await settingsService.updateProfile({
        business_name: businessName,
        slug,
        whatsapp_number: whatsapp,
      });
      Alert.alert("Saved", "Business settings updated.");
    } catch (error) {
      Alert.alert("Update failed", (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Profile header ── */}
        <View style={[styles.profileHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Avatar name={(businessName || user?.email) ?? "B"} size={56} />
          <View style={styles.profileInfo}>
            <Text style={[typography.headingLg, { color: colors.text }]}>{businessName || "Your Business"}</Text>
            <Text style={[typography.bodyMd, { color: colors.mutedText }]}>{user?.email}</Text>
          </View>
        </View>

        {/* ── Store link card ── */}
        {slug ? (
          <View style={styles.section}>
            <View style={[styles.storeLinkCard, shadows.sm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Feather name="link" size={18} color={colors.primary} />
              <Text style={[typography.headingSm, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                /store/{slug}
              </Text>
              <Pressable
                onPress={() => Clipboard.setStringAsync(storeLink)}
                style={[styles.copyBtn, { backgroundColor: colors.primaryLight }]}
              >
                <Feather name="copy" size={14} color={colors.primary} />
              </Pressable>
              <Pressable
                onPress={() => Share.share({ message: storeLink })}
                style={[styles.copyBtn, { backgroundColor: colors.surfaceAlt }]}
              >
                <Feather name="share-2" size={14} color={colors.mutedText} />
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* ── Business form ── */}
        <View style={styles.section}>
          <Text style={[typography.headingMd, { color: colors.text, marginBottom: spacing.sm }]}>Business profile</Text>
          <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {[
              { label: "Business name", value: businessName, onChange: setBusinessName, icon: "briefcase" as const },
              { label: "Store slug", value: slug, onChange: setSlug, icon: "at-sign" as const },
              { label: "WhatsApp number", value: whatsapp, onChange: setWhatsapp, icon: "phone" as const },
            ].map(({ label, value, onChange, icon }) => (
              <View key={label} style={[styles.formRow, { borderBottomColor: colors.border }]}>
                <Feather name={icon} size={16} color={colors.mutedText} style={{ marginRight: spacing.sm }} />
                <View style={styles.formField}>
                  <Text style={[typography.caption, { color: colors.mutedText }]}>{label}</Text>
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    style={[typography.bodyMd, { color: colors.text, padding: 0, marginTop: 2 }]}
                    placeholderTextColor={colors.subtleText}
                    placeholder={`Enter ${label.toLowerCase()}`}
                  />
                </View>
              </View>
            ))}
          </View>
          <AppButton title="Save changes" icon="check" loading={saving} onPress={save} style={{ marginTop: spacing.sm }} />
        </View>

        {/* ── Menu groups ── */}
        {MENU_GROUPS.map((group) => (
          <View key={group.title} style={styles.section}>
            <Text style={[typography.label, { color: colors.mutedText, marginBottom: spacing.sm, textTransform: "uppercase" }]}>
              {group.title}
            </Text>
            <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {group.items.map((item, idx) => (
                <Pressable
                  key={item.screen}
                  onPress={() => navigation.navigate(item.screen as any)}
                  style={({ pressed }) => [
                    styles.menuRow,
                    { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 },
                    idx === group.items.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={[styles.menuIcon, { backgroundColor: colors.primaryLight }]}>
                    <Feather name={item.icon} size={16} color={colors.primary} />
                  </View>
                  <Text style={[typography.bodyLg, { color: colors.text, flex: 1 }]}>{item.label}</Text>
                  <Feather name="chevron-right" size={16} color={colors.subtleText} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {/* ── Sign out ── */}
        <View style={[styles.section, { paddingBottom: spacing.xxl }]}>
          <Pressable
            onPress={signOut}
            style={({ pressed }) => [
              styles.signOutBtn,
              { borderColor: colors.danger, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="log-out" size={16} color={colors.danger} />
            <Text style={[typography.headingMd, { color: colors.danger, marginLeft: spacing.sm }]}>
              Sign out
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  profileInfo: { flex: 1 },
  section: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  storeLinkCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  copyBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  formCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  formRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
  },
  formField: { flex: 1 },
  menuCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    borderRadius: radius.md,
  },
});
