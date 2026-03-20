import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getAllDrafts, deleteDraft } from '@/lib/db';
import { syncPendingDrafts } from '@/lib/sync';
import { useQueryClient } from '@tanstack/react-query';

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-PH', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function SyncScreen() {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Awaited<ReturnType<typeof getAllDrafts>>>([]);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    // Sync tab only shows offline-saved records (not user drafts)
    const all = await getAllDrafts();
    setDrafts(all.filter((d) => d.source === 'offline'));
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await syncPendingDrafts();
      await load();
      qc.invalidateQueries({ queryKey: ['submissions'] });
      Alert.alert('Sync Complete', `Synced: ${result.synced}  Failed: ${result.failed}`);
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete(id: string) {
    Alert.alert('Delete', 'Delete this draft?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await deleteDraft(id); await load(); },
      },
    ]);
  }

  const pending = drafts.filter((d) => !d.synced);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sync</Text>
        <Text style={styles.sub}>{pending.length} pending · {drafts.length} offline records</Text>
      </View>

      <TouchableOpacity
        style={[styles.btn, (syncing || pending.length === 0) && styles.btnDisabled]}
        onPress={handleSync}
        disabled={syncing || pending.length === 0}
      >
        {syncing
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Sync All Pending ({pending.length})</Text>
        }
      </TouchableOpacity>

      <FlatList
        data={drafts}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>No drafts saved locally.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.formType}>
                {item.form_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </Text>
              <Text style={styles.meta}>{formatDate(item.created_at)}</Text>
              <View style={[styles.badge, { backgroundColor: item.synced ? '#dcfce7' : '#fef3c7' }]}>
                <Text style={{ fontSize: 11, color: item.synced ? '#15803d' : '#92400e', fontWeight: '600' }}>
                  {item.synced ? 'Synced' : 'Pending'}
                </Text>
              </View>
            </View>
            {!item.synced && (
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                <Text style={{ color: '#ef4444', fontSize: 13 }}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f9fafb' },
  header:      { padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  title:       { fontSize: 20, fontWeight: '700', color: '#111827' },
  sub:         { fontSize: 13, color: '#6b7280', marginTop: 2 },
  btn:         { marginHorizontal: 16, marginTop: 16, backgroundColor: '#16a34a', borderRadius: 10, padding: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText:     { color: '#fff', fontWeight: '700', fontSize: 15 },
  empty:       { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
  card:        { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 1 },
  formType:    { fontSize: 14, fontWeight: '600', color: '#111827' },
  meta:        { fontSize: 12, color: '#9ca3af', marginBottom: 4 },
  badge:       { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  deleteBtn:   { padding: 8 },
});
