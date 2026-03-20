import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  Draft: '#f59e0b', Submitted: '#3b82f6', Validated: '#16a34a',
};

function Row({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value ?? '—'}</Text>
    </View>
  );
}

export default function SubmissionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: sub, isLoading } = useQuery({
    queryKey: ['submission', id],
    queryFn: () => api.get(`/submissions/${id}`).then((r) => r.data),
  });

  if (isLoading) return <ActivityIndicator style={{ marginTop: 60 }} color="#16a34a" size="large" />;
  if (!sub) return <View style={styles.center}><Text>Not found.</Text></View>;

  const fd = sub.form_data ?? {};

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, { backgroundColor: STATUS_COLORS[sub.status] ?? '#6b7280' }]}>
        <Text style={styles.formType}>{sub.form_type?.replace(/_/g, ' ')}</Text>
        <Text style={styles.status}>{sub.status}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Summary</Text>
        <Row label="Barangay" value={sub.barangay?.name} />
        <Row label="Inventory Year" value={sub.inventory_year?.year} />
        <Row label="Data Source" value={sub.data_source} />
        <Row label="CO₂e (tonnes)" value={sub.computation?.co2e_tonnes != null ? Number(sub.computation.co2e_tonnes).toFixed(4) : undefined} />
        <Row label="CO₂ (tonnes)"  value={sub.computation?.co2_tonnes  != null ? Number(sub.computation.co2_tonnes).toFixed(4)  : undefined} />
        <Row label="CH₄ (tonnes)"  value={sub.computation?.ch4_tonnes  != null ? Number(sub.computation.ch4_tonnes).toFixed(4)  : undefined} />
        <Row label="N₂O (tonnes)"  value={sub.computation?.n2o_tonnes  != null ? Number(sub.computation.n2o_tonnes).toFixed(4)  : undefined} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Form Data</Text>
        {Object.entries(fd).map(([k, v]) => (
          <Row key={k} label={k.replace(/_/g, ' ')} value={String(v)} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 24, paddingTop: 32 },
  formType: { fontSize: 20, fontWeight: '700', color: '#fff', textTransform: 'capitalize' },
  status: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  section: { backgroundColor: '#fff', margin: 16, borderRadius: 12, padding: 16, elevation: 1 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  rowLabel: { fontSize: 13, color: '#6b7280', textTransform: 'capitalize', flex: 1 },
  rowValue: { fontSize: 13, color: '#111827', fontWeight: '500', flex: 1, textAlign: 'right' },
});
