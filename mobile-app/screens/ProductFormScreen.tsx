import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { StyleSheet, Switch, Text } from "react-native";

import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { ScreenContainer } from "../components/ScreenContainer";
import { showSaveError } from "../lib/alertHelpers";
import { ALERT_TITLES } from "../lib/alertTitles";
import { useThemeColors } from "../lib/theme";
import type { RootStackParamList } from "../navigation/types";
import { productService } from "../services/productService";

type Props = NativeStackScreenProps<RootStackParamList, "ProductForm">;

export function ProductFormScreen({ route, navigation }: Props) {
  const colors = useThemeColors();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [trackInventory, setTrackInventory] = useState(false);
  const [stockQuantity, setStockQuantity] = useState("0");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");

  useEffect(() => {
    const load = async () => {
      const productId = route.params?.productId;
      if (!productId) return;
      const rows = await productService.listProducts();
      const found = rows.find((row) => row.id === productId);
      if (!found) return;
      setName(found.name);
      setDescription(found.description ?? "");
      setPrice(String(found.price));
      setIsActive(found.is_active);
      setTrackInventory(Boolean(found.track_inventory));
      setStockQuantity(String(Number(found.stock_quantity ?? 0)));
      setLowStockThreshold(String(Number(found.low_stock_threshold ?? 5)));
    };

    load().catch(() => undefined);
  }, [route.params?.productId]);

  const submit = async () => {
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        price: Number(price),
        track_inventory: trackInventory,
        stock_quantity: trackInventory ? Number(stockQuantity || 0) : null,
        low_stock_threshold: trackInventory ? Number(lowStockThreshold || 0) : 0,
      };

      if (route.params?.productId) {
        await productService.updateProduct(route.params.productId, { ...payload, is_active: isActive });
      } else {
        await productService.createProduct(payload);
      }

      navigation.goBack();
    } catch (error) {
      showSaveError(ALERT_TITLES.error.unableToSaveProduct, error, "Unable to save this product right now.");
    }
  };

  return (
    <ScreenContainer>
      <Text style={[styles.title, { color: colors.text }]}>Product form</Text>
      <AppInput label="Product name" value={name} onChangeText={setName} />
      <AppInput label="Description" value={description} onChangeText={setDescription} />
      <AppInput label="Price (NGN)" value={price} onChangeText={setPrice} keyboardType="numeric" />
      <Text style={{ color: colors.mutedText }}>Active listing</Text>
      <Switch value={isActive} onValueChange={setIsActive} />
      <Text style={{ color: colors.mutedText }}>Track inventory</Text>
      <Switch value={trackInventory} onValueChange={setTrackInventory} />
      {trackInventory ? (
        <>
          <AppInput label="Stock quantity" value={stockQuantity} onChangeText={setStockQuantity} keyboardType="numeric" />
          <AppInput
            label="Low stock threshold"
            value={lowStockThreshold}
            onChangeText={setLowStockThreshold}
            keyboardType="numeric"
          />
        </>
      ) : null}
      <AppButton title="Save product" onPress={submit} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
});
