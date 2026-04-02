import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";

import { AppInput } from "../components/AppInput";
import { BottomActionButton } from "../components/BottomActionButton";
import { CustomerCard } from "../components/CustomerCard";
import { EmptyState } from "../components/EmptyState";
import { ScreenContainer } from "../components/ScreenContainer";
import { spacing } from "../lib/theme";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";
import { customerService } from "../services/customerService";
import type { Customer } from "../types/domain";

type Props = BottomTabScreenProps<MainTabParamList, "Customers">;

export function CustomersScreen(_: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);

  useFocusEffect(
    useCallback(() => {
      customerService.listCustomers().then(setCustomers).catch(() => setCustomers([]));
    }, [])
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q)
    );
  }, [customers, query]);

  return (
    <ScreenContainer
      scroll={false}
      title={`Customers (${customers.length})`}
      noPadding
    >
      <View style={styles.searchWrap}>
        <AppInput
          label=""
          value={query}
          onChangeText={setQuery}
          placeholder="Search name or phone…"
          icon="search"
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="users"
            title={query ? "No results" : "No customers yet"}
            subtitle={query ? "Try a different search." : "Customers from orders will appear here."}
          />
        }
        renderItem={({ item }) => (
          <CustomerCard
            customer={item}
            onPress={() => navigation.navigate("CustomerProfile", { customerId: item.id })}
          />
        )}
      />
      <BottomActionButton
        label="Add customer"
        icon="user-plus"
        onPress={() => navigation.navigate("CustomerForm")}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: 0,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100,
  },
});
