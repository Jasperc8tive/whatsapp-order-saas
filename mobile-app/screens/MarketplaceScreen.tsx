import * as Linking from "expo-linking";
import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { ScreenContainer } from "../components/ScreenContainer";
import { useThemeColors } from "../lib/theme";
import { marketplaceService, type MarketplaceVendor } from "../services/marketplaceService";

export function MarketplaceScreen() {
  const colors = useThemeColors();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState<MarketplaceVendor[]>([]);

  const load = async (q: string) => {
    setLoading(true);
    try {
      const rows = await marketplaceService.listVendors(q);
      setVendors(rows);
    } catch (error) {
      Alert.alert("Failed to load marketplace", (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load("").catch(() => undefined);
  }, []);

  return (
    <ScreenContainer>
      <Text style={[styles.title, { color: colors.text }]}>Vendor marketplace</Text>
      <Text style={{ color: colors.mutedText }}>
        Discover active WhatsOrder vendors and open their storefront links.
      </Text>
      <AppInput label="Search vendors" value={query} onChangeText={setQuery} placeholder="Burger, shawarma, Abuja..." />
      <AppButton title={loading ? "Searching..." : "Search"} variant="secondary" onPress={() => load(query)} disabled={loading} />

      {vendors.map((vendor) => {
        const url = marketplaceService.vendorStoreLink(vendor.slug);
        return (
          <View key={vendor.id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
            <Text style={[styles.name, { color: colors.text }]}>{vendor.businessName}</Text>
            <Text style={{ color: colors.mutedText }}>/{vendor.slug}</Text>
            <View style={styles.row}>
              <AppButton title="Open store" variant="secondary" onPress={() => Linking.openURL(url)} />
              <AppButton
                title="WhatsApp"
                variant="secondary"
                onPress={() => {
                  if (!vendor.whatsappNumber) {
                    Alert.alert("No number", "This vendor has no public WhatsApp number yet.");
                    return;
                  }
                  const wa = `https://wa.me/${vendor.whatsappNumber.replace(/\D/g, "")}`;
                  Linking.openURL(wa).catch(() => undefined);
                }}
              />
            </View>
          </View>
        );
      })}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
});
