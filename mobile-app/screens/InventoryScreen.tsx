import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "../components/AppButton";
import { ScreenContainer } from "../components/ScreenContainer";
import { showLoadError, showUpdateError } from "../lib/alertHelpers";
import { ALERT_TITLES } from "../lib/alertTitles";
import { useThemeColors } from "../lib/theme";
import { productService } from "../services/productService";
import type { Product } from "../types/domain";

export function InventoryScreen() {
  const colors = useThemeColors();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await productService.listProducts();
      setProducts(rows.filter((item) => item.track_inventory));
    } catch (error) {
      showLoadError(ALERT_TITLES.error.unableToLoadInventory, error, "Unable to load inventory right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const lowStockCount = useMemo(
    () => products.filter((item) => Number(item.stock_quantity ?? 0) <= Number(item.low_stock_threshold ?? 5)).length,
    [products]
  );

  const adjust = async (item: Product, delta: number) => {
    try {
      const next = Math.max(0, Number(item.stock_quantity ?? 0) + delta);
      await productService.updateProduct(item.id, { stock_quantity: next });
      setProducts((prev) => prev.map((row) => (row.id === item.id ? { ...row, stock_quantity: next } : row)));
    } catch (error) {
      showUpdateError(ALERT_TITLES.error.unableToUpdateStock, error, "Unable to update stock right now.");
    }
  };

  return (
    <ScreenContainer>
      <Text style={[styles.title, { color: colors.text }]}>Inventory tracking</Text>
      <Text style={{ color: colors.mutedText }}>
        {loading ? "Loading inventory..." : `${products.length} tracked products • ${lowStockCount} low stock alerts`}
      </Text>
      <AppButton title="Refresh" variant="secondary" onPress={load} disabled={loading} />

      {products.map((item) => {
        const stock = Number(item.stock_quantity ?? 0);
        const threshold = Number(item.low_stock_threshold ?? 5);
        const isLow = stock <= threshold;
        return (
          <View key={item.id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
            <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
            <Text style={{ color: isLow ? colors.danger : colors.mutedText }}>
              Stock: {stock} • Threshold: {threshold} {isLow ? "(LOW)" : ""}
            </Text>
            <View style={styles.row}>
              <AppButton title="-1" variant="secondary" onPress={() => adjust(item, -1)} />
              <AppButton title="+1" variant="secondary" onPress={() => adjust(item, 1)} />
              <AppButton title="+5" variant="secondary" onPress={() => adjust(item, 5)} />
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
