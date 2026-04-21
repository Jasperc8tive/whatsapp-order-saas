import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { radius, spacing, typography, useThemeColors } from "../lib/theme";

interface AppInputProps extends TextInputProps {
  label: string;
  error?: string;
  icon?: keyof typeof Feather.glyphMap;
  hint?: string;
}

export function AppInput({ label, error, icon, hint, ...props }: AppInputProps) {
  const colors = useThemeColors();

  return (
    <View style={styles.container}>
      <Text style={[typography.bodySm, styles.label, { color: colors.mutedText }]}>{label}</Text>
      <View
        style={[
          styles.inputWrapper,
          {
            borderColor: error ? colors.danger : colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      >
        {icon && (
          <Feather
            name={icon}
            size={16}
            color={colors.mutedText}
            style={styles.inputIcon}
          />
        )}
        <TextInput
          {...props}
          placeholderTextColor={colors.subtleText}
          style={[
            styles.input,
            {
              color: colors.text,
              flex: 1,
            },
          ]}
        />
      </View>
      {!!hint && !error && (
        <Text style={[typography.caption, { color: colors.subtleText, marginTop: spacing.xs }]}>{hint}</Text>
      )}
      {!!error && (
        <Text style={[typography.caption, { color: colors.danger, marginTop: spacing.xs }]}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { marginBottom: spacing.xs },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    gap: spacing.sm,
  },
  input: {
    fontSize: 15,
    padding: 0,
  },
  inputIcon: {
    marginRight: 2,
  },
});

