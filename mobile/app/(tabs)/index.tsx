import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/supabase';

export default function HomeScreen() {
  const { session } = useAuth();

  const userEmail = useMemo(() => session?.user?.email ?? 'Unknown user', [session?.user?.email]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Sign out failed', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>WhatsOrder Mobile</Text>
      <Text style={styles.subheading}>Signed in as {userEmail}</Text>

      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Orders today</Text>
          <Text style={styles.kpiValue}>0</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Pending delivery</Text>
          <Text style={styles.kpiValue}>0</Text>
        </View>
      </View>

      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
    padding: 20,
    gap: 16,
    justifyContent: 'center',
  },
  heading: {
    fontSize: 30,
    fontWeight: '700',
    color: '#111827',
  },
  subheading: {
    color: '#374151',
    fontSize: 15,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  kpiLabel: {
    color: '#6b7280',
    fontSize: 13,
  },
  kpiValue: {
    color: '#111827',
    fontSize: 26,
    fontWeight: '700',
    marginTop: 6,
  },
  signOutButton: {
    marginTop: 6,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
