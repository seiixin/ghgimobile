import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Network from 'expo-network';
import api from '@/lib/api';

interface DraftSubmission {
  id: number;
  form_type: string;
  status: string;
  created_at: string;
  barangay?: { name: string };
  inventory_year?: { year: number };
  computation?: { co2e_tonnes: string | number | null };
}

function formatType(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DraftsScreen() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      // Fetch all submissions and filter to Draft status
      const { data } = await api.get('/submissions?per_page=100');
      const all: DraftSubmission[] = data?.data ?? data ?? [];
      setDrafts(all.filter((s) => s.status === 'Draft'));
    } catch {
      // Offline or error — show empty
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleSubmit(item: DraftSubmission) {
    const net = await Network.getNetworkStateAsync();
    if (!net.isConnected || !net.isInternetReachable) {
      Alert.alert('Offline', 'You need an internet connection to submit.');
      return;
    }

    setSubmitting(item.id);
    try {
      await api.patch(`/submissions/${item.id}/submit`);
      await load();
      Alert.alert('Submitted', 'Draft submitted successfully.');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Submission failed. Try again.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(null);
    }
  }

  if (loading && drafts.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#16a34a" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={drafts}
        keyExtractor={(d) => String(d.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Drafts</Text>
            <Text style={styles.sub}>{drafts.length} draft{drafts.length !== 1 ? 's' : ''} pending submission</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>No drafts found.</Text>
            <Text style={styles.emptySub}>Submissions saved as Draft will appear here. Tap Submit to send them.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isSub = submitting === item.id;
          const co2e = item.computation?.co2e_tonnes;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push({ pathname: '/submission/[id]', params: { id: item.id } })}
              activeOpacity={0.85}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.formType}>{formatType(item.form_type)}</Text>
                <View style={styles.draftBadge}>
                  <Text style={styles.draftBadgeText}>Draft</Text>
                </View>
              </View>

              <Text style={styles.barangay}>{item.barangay?.name ?? '—'}</Text>
              <Text style={styles.meta}>
                {item.inventory_year?.year ?? '—'}
                {co2e != null ? ` · CO₂e: ${Number(co2e).toFixed(2)} t` : ''}
              </Text>

              <TouchableOpacity
                style={[styles.submitBtn, isSub && { opacity: 0.6 }]}
                onPress={(e) => { e.stopPropagation?.(); handleSubmit(item); }}
                disabled={isSub}
              >
                {isSub
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.submitBtnText}>Submit</Text>
                }
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f9fafb' },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:         { marginBottom: 12 },
  title:          { fontSize: 20, fontWeight: '700', color: '#111827' },
  sub:            { fontSize: 13, color: '#6b7280', marginTop: 2 },
  emptyWrap:      { alignItems: 'center', marginTop: 60 },
  emptyIcon:      { fontSize: 48, marginBottom: 12 },
  emptyText:      { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptySub:       { fontSize: 13, color: '#9ca3af', marginTop: 6, textAlign: 'center', paddingHorizontal: 32 },
  card:           { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, elevation: 2, borderLeftWidth: 3, borderLeftColor: '#f59e0b' },
  cardHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  formType:       { fontSize: 15, fontWeight: '600', color: '#111827', textTransform: 'capitalize', flex: 1 },
  draftBadge:     { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  draftBadgeText: { fontSize: 11, color: '#92400e', fontWeight: '700' },
  barangay:       { fontSize: 13, color: '#374151', marginBottom: 2 },
  meta:           { fontSize: 12, color: '#9ca3af', marginBottom: 12 },
  submitBtn:      { backgroundColor: '#16a34a', borderRadius: 8, padding: 12, alignItems: 'center' },
  submitBtnText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
});
