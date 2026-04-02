import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import { Alert, FlatList, StyleSheet, View } from "react-native";

import { BottomActionButton } from "../components/BottomActionButton";
import { EmptyState } from "../components/EmptyState";
import { ProductCard } from "../components/ProductCard";
import { ScreenContainer } from "../components/ScreenContainer";
import { spacing } from "../lib/theme";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";
import { productService } from "../services/productService";
import type { Product } from "../types/domain";

type Props = BottomTabScreenProps<MainTabParamList, "Products">;

export function ProductsScreen(_: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [products, setProducts] = useState<Product[]>([]);

  const load = useCallback(async () => {
    const rows = await productService.listProducts();
    setProducts(rows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  const remove = (id: string) => {
    Alert.alert("Delete product", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await productService.deleteProduct(id);
          await load();
        },
      },
    ]);
  };

  return (
    <ScreenContainer
      scroll={false}
      title="Products"
      headerRight={{
        icon: "layers",
        label: "Inventory",
        onPress: () => navigation.navigate("Inventory"),
      }}
      noPadding
    >
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="package"
            title="No products yet"
            subtitle="Add your first product to start selling."
          />
        }
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            onEdit={() => navigation.navigate("ProductForm", { productId: item.id })}
            onDelete={() => remove(item.id)}
          />
        )}
      />
      <BottomActionButton
        label="Add product"
        icon="plus"
        onPress={() => navigation.navigate("ProductForm")}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 100,
  },
});
