import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/supabase';
import { getCurrentWorkspaceId } from '@/lib/workspace';

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  created_at: string;
};

export default function CustomersScreen() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);

  const loadCustomers = useCallback(async (isRefresh = false) => {
    const userId = session?.user?.id;
    if (!userId) {
      setLoading(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    const workspaceId = await getCurrentWorkspaceId(userId);

    const { data, error: fetchError } = await supabase
      .from('customers')
      .select('id, name, phone, created_at')
      .eq('vendor_id', workspaceId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setCustomers([]);
    } else {
      setCustomers((data ?? []) as CustomerRow[]);
    }

    setLoading(false);
    setRefreshing(false);
  }, [session?.user?.id]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const emptyText = useMemo(() => {
    if (error) {
      return `Could not load customers: ${error}`;
    }

    return 'No customers yet. New customers will appear here after your first order.';
  }, [error]);

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator />
        <Text style={styles.stateText}>Loading customers...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Customers</Text>
      <Text style={styles.subheading}>Your latest customer records</Text>

      <FlatList
        data={customers}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadCustomers(true)} />}
        contentContainerStyle={customers.length === 0 ? styles.emptyListContainer : styles.listContent}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => {
              router.push({
                pathname: '/customer/[id]',
                params: { id: item.id },
              });
            }}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.phone}>{item.phone}</Text>
            <Text style={styles.createdAt}>{new Date(item.created_at).toLocaleDateString()}</Text>
            <Text style={styles.viewDetails}>View details</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>{emptyText}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  subheading: {
    marginTop: 4,
    marginBottom: 14,
    fontSize: 14,
    color: '#4b5563',
  },
  listContent: {
    paddingBottom: 24,
    gap: 10,
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    marginBottom: 10,
  },
  name: {
    fontSize: 17,
    color: '#111827',
    fontWeight: '600',
  },
  phone: {
    fontSize: 14,
    color: '#374151',
    marginTop: 4,
  },
  createdAt: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
  },
  viewDetails: {
    marginTop: 8,
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '600',
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f4f6f8',
    gap: 10,
  },
  stateText: {
    fontSize: 14,
    color: '#4b5563',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 14,
  },
});
