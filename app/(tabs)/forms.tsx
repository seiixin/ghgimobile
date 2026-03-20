import { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

const SECTORS = [
  {
    sector: 'Agriculture',
    forms: [
      { key: 'livestock', label: 'Livestock' },
      { key: 'crops', label: 'Crops' },
    ],
  },
  {
    sector: 'Waste',
    forms: [
      { key: 'solid_waste', label: 'Solid Waste' },
      { key: 'wastewater', label: 'Wastewater' },
      { key: 'biological_treatment', label: 'Biological Treatment' },
    ],
  },
  {
    sector: 'Industry',
    forms: [{ key: 'industrial_processes', label: 'Industrial Processes' }],
  },
  {
    sector: 'Transportation',
    forms: [
      { key: 'mobile_combustion', label: 'Mobile Combustion' },
      { key: 'air_travel', label: 'Air Travel' },
      { key: 'business_travel', label: 'Business Travel' },
    ],
  },
  {
    sector: 'Forestry',
    forms: [
      { key: 'forestry', label: 'Forestry / Land Use' },
      { key: 'forestry_removal', label: 'Forestry Removal (GHG Removal from Sink)' },
    ],
  },
  {
    sector: 'Energy',
    forms: [
      { key: 'stationary_combustion', label: 'Stationary Combustion' },
      { key: 'electricity_consumption', label: 'Electricity Consumption' },
    ],
  },
];

export default function FormsScreen() {
  const router = useRouter();
  const { sector: sectorParam } = useLocalSearchParams<{ sector?: string }>();
  const [search, setSearch] = useState('');
  const listRef = useRef<FlatList>(null);

  const filtered = SECTORS.map((s) => ({
    ...s,
    forms: s.forms.filter((f) => f.label.toLowerCase().includes(search.toLowerCase())),
  })).filter((s) => s.forms.length > 0);

  // When navigated from dashboard with a sector param, scroll to that sector
  useEffect(() => {
    if (!sectorParam || search) return;
    const idx = filtered.findIndex((s) => s.sector.toLowerCase() === sectorParam.toLowerCase());
    if (idx >= 0) {
      setTimeout(() => listRef.current?.scrollToIndex({ index: idx, animated: true }), 300);
    }
  }, [sectorParam]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search forms..."
        value={search}
        onChangeText={setSearch}
        placeholderTextColor="#9ca3af"
      />
      <FlatList
        ref={listRef}
        data={filtered}
        keyExtractor={(item) => item.sector}
        onScrollToIndexFailed={() => {}}
        renderItem={({ item }) => (
          <View style={[
            styles.group,
            sectorParam && item.sector.toLowerCase() === sectorParam.toLowerCase() && styles.groupHighlight,
          ]}>
            <Text style={styles.sectorLabel}>{item.sector}</Text>
            {item.forms.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={styles.formRow}
                onPress={() => router.push({ pathname: '/form/[type]', params: { type: f.key } })}
              >
                <Text style={styles.formLabel}>{f.label}</Text>
                <Text style={styles.arrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        contentContainerStyle={{ padding: 16 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  search: {
    margin: 16, marginBottom: 8, backgroundColor: '#fff', borderRadius: 10,
    padding: 12, fontSize: 14, borderWidth: 1, borderColor: '#e5e7eb', color: '#111827',
  },
  group: { marginBottom: 16 },
  groupHighlight: { backgroundColor: '#f0fdf4', borderRadius: 10, padding: 8, borderWidth: 1, borderColor: '#86efac' },
  sectorLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  formRow: {
    backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 6,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 1,
  },
  formLabel: { fontSize: 15, color: '#111827', fontWeight: '500' },
  arrow: { fontSize: 20, color: '#9ca3af' },
});
