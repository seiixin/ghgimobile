import { useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import api from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  Draft: '#f59e0b',
  Submitted: '#3b82f6',
  Validated: '#16a34a',
};

export default function SubmissionsScreen() {
  const router = useRouter();
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['submissions', page],
    queryFn: () => api.get(`/submissions?page=${page}`).then((r) => r.data),
  });

  const submissions = data?.data ?? [];

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#16a34a" size="large" />
      ) : (
        <FlatList
          data={submissions}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={styles.empty}>No submissions yet.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push({ pathname: '/submission/[id]', params: { id: item.id } })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.formType}>{item.form_type?.replace(/_/g, ' ')}</Text>
                <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] + '22' }]}>
                  <Text style={[styles.badgeText, { color: STATUS_COLORS[item.status] }]}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.barangay}>{item.barangay?.name ?? '—'}</Text>
              <Text style={styles.meta}>
                {item.inventory_year?.year ?? '—'} · CO₂e: {
                  item.computation?.co2e_tonnes != null
                    ? Number(item.computation.co2e_tonnes).toFixed(2)
                    : '—'
                } t
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 15 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  formType: { fontSize: 15, fontWeight: '600', color: '#111827', textTransform: 'capitalize' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  barangay: { fontSize: 13, color: '#374151', marginBottom: 2 },
  meta: { fontSize: 12, color: '#9ca3af' },
});
