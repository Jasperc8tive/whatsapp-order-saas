import React, { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { AppButton } from "../components/AppButton";
import { AppInput } from "../components/AppInput";
import { ScreenContainer } from "../components/ScreenContainer";
import { showSendError, showSuccess } from "../lib/alertHelpers";
import { ALERT_TITLES } from "../lib/alertTitles";
import { useThemeColors } from "../lib/theme";
import { teamService } from "../services/teamService";
import type { WorkspaceMember, WorkspaceRole } from "../types/domain";

const roles: WorkspaceRole[] = ["owner", "staff", "delivery_manager"];

export function TeamManagementScreen() {
  const colors = useThemeColors();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("staff");

  const load = useCallback(async () => {
    const rows = await teamService.listMembers();
    setMembers(rows);
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const invite = async () => {
    try {
      await teamService.inviteMember(email.trim(), role);
      showSuccess(ALERT_TITLES.success.sent, `Invitation sent to ${email}`);
      setEmail("");
      await load();
    } catch (error) {
      showSendError(ALERT_TITLES.error.unableToSendInvite, error, "Unable to send this invitation right now.");
    }
  };

  return (
    <ScreenContainer scroll={false}>
      <Text style={[styles.title, { color: colors.text }]}>Team management</Text>
      <AppInput label="Invite email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Text style={{ color: colors.mutedText }}>Role: {role}</Text>
      <View style={styles.roleRow}>
        {roles.map((value) => (
          <AppButton
            key={value}
            title={value}
            variant={role === value ? "primary" : "secondary"}
            onPress={() => setRole(value)}
          />
        ))}
      </View>
      <AppButton title="Invite member" onPress={invite} />

      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              {item.display_name ?? item.user_id.slice(0, 8)}
            </Text>
            <Text style={{ color: colors.mutedText }}>{item.role}</Text>
            <Text style={{ color: colors.mutedText }}>{item.is_active ? "Active" : "Inactive"}</Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  roleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
});
