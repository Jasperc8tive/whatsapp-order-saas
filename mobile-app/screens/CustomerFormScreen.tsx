import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";

import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { ScreenContainer } from "../components/ScreenContainer";
import { showSaveError } from "../lib/alertHelpers";
import { ALERT_TITLES } from "../lib/alertTitles";
import { useThemeColors } from "../lib/theme";
import type { RootStackParamList } from "../navigation/types";
import { customerService } from "../services/customerService";

type Props = NativeStackScreenProps<RootStackParamList, "CustomerForm">;

export function CustomerFormScreen({ route, navigation }: Props) {
  const colors = useThemeColors();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const customerId = route.params?.customerId;
      if (!customerId) return;
      const customer = await customerService.getCustomerById(customerId);
      if (!customer) return;
      setName(customer.name);
      setPhone(customer.phone);
      setEmail(customer.email ?? "");
      setAddress(customer.address ?? "");
    };

    load().catch(() => undefined);
  }, [route.params?.customerId]);

  const onSave = async () => {
    try {
      setLoading(true);
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        address: address.trim() || null,
      };

      if (route.params?.customerId) {
        await customerService.updateCustomer(route.params.customerId, payload);
      } else {
        await customerService.createCustomer(payload);
      }

      navigation.goBack();
    } catch (error) {
      showSaveError(ALERT_TITLES.error.unableToSaveCustomer, error, "Unable to save this customer right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <Text style={[styles.title, { color: colors.text }]}>Customer</Text>
      <AppInput label="Name" value={name} onChangeText={setName} />
      <AppInput label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <AppInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <AppInput label="Address" value={address} onChangeText={setAddress} />
      <AppButton title={loading ? "Saving..." : "Save customer"} onPress={onSave} disabled={loading} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
});
