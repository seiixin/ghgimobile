import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useAuthStore } from '@/lib/store';
import { getAllDrafts } from '@/lib/db';
import * as Network from 'expo-network';
import { useRouter } from 'expo-router';

interface StatCard { label: string; value: string | number; color: string; emoji: string }

function Card({ label, value, color, emoji }: StatCard) {
  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <Text style={styles.cardEmoji}>{emoji}</Text>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

const SECTORS = [
  { name: 'Agriculture',    emoji: '🌾' },
  { name: 'Waste',          emoji: '🗑️' },
  { name: 'Industry',       emoji: '🏭' },
  { name: 'Transportation', emoji: '🚗' },
  { name: 'Forestry',       emoji: '🌳' },
  { name: 'Energy',         emoji: '⚡' },
];

export default function DashboardScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [drafts, setDrafts] = useState(0);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const all = await getAllDrafts();
    setDrafts(all.length);
    setPending(all.filter((d) => !d.synced).length);
    const net = await Network.getNetworkStateAsync();
    setOnline(!!net.isConnected && !!net.isInternetReachable);
  }

  useEffect(() => { load(); }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]} 👋</Text>
        <Text style={styles.role}>{user?.role?.replace('_', ' ')}</Text>
        <View style={[styles.badge, { backgroundColor: online ? '#dcfce7' : '#fee2e2' }]}>
          <Text style={{ color: online ? '#15803d' : '#dc2626', fontSize: 12, fontWeight: '600' }}>
            {online ? '🟢 Online' : '🔴 Offline'}
          </Text>
        </View>
      </View>

      <View style={styles.grid}>
        <Card label="Offline Drafts" value={drafts} color="#f59e0b" emoji="📝" />
        <Card label="Pending Sync" value={pending} color="#ef4444" emoji="🔄" />
        <Card label="Status" value={online ? 'Online' : 'Offline'} color={online ? '#16a34a' : '#6b7280'} emoji="📡" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sectors (AWITFE)</Text>
        {SECTORS.map((s) => (
          <TouchableOpacity
            key={s.name}
            style={styles.sectorRow}
            onPress={() => router.push({ pathname: '/(tabs)/forms', params: { sector: s.name } })}
          >
            <Text style={styles.sectorEmoji}>{s.emoji}</Text>
            <Text style={styles.sectorText}>{s.name}</Text>
            <Text style={styles.sectorArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { backgroundColor: '#15803d', padding: 24, paddingTop: 48 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#fff' },
  role: { fontSize: 13, color: '#bbf7d0', marginTop: 2 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginTop: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12 },
  card: { flex: 1, minWidth: '28%', backgroundColor: '#fff', borderRadius: 12, padding: 16, borderLeftWidth: 4, elevation: 2 },
  cardEmoji: { fontSize: 24, marginBottom: 6 },
  cardValue: { fontSize: 22, fontWeight: '700', color: '#111827' },
  cardLabel: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 10 },
  sectorRow: { backgroundColor: '#fff', borderRadius: 8, padding: 14, marginBottom: 8, elevation: 1, flexDirection: 'row', alignItems: 'center' },
  sectorEmoji: { fontSize: 20, marginRight: 10 },
  sectorText: { fontSize: 14, color: '#374151', fontWeight: '500', flex: 1 },
  sectorArrow: { fontSize: 20, color: '#9ca3af' },
});
