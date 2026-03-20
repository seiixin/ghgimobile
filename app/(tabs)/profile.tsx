import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';

export default function ProfileScreen() {
  const { user, clearAuth } = useAuthStore();

  async function handleLogout() {
    try {
      await api.post('/logout');
    } catch { /* ignore network errors on logout */ }
    await clearAuth();
  }

  function confirmLogout() {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: handleLogout },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() ?? '?'}</Text>
      </View>
      <Text style={styles.name}>{user?.name}</Text>
      <Text style={styles.email}>{user?.email}</Text>
      <View style={styles.roleBadge}>
        <Text style={styles.roleText}>{user?.role?.replace('_', ' ')}</Text>
      </View>

      <View style={styles.divider} />

      <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', alignItems: 'center', paddingTop: 60 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#16a34a', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  avatarText: { fontSize: 32, color: '#fff', fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700', color: '#111827' },
  email: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  roleBadge: { marginTop: 10, backgroundColor: '#dcfce7', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  roleText: { color: '#15803d', fontWeight: '600', fontSize: 13 },
  divider: { width: '80%', height: 1, backgroundColor: '#e5e7eb', marginVertical: 32 },
  logoutBtn: { backgroundColor: '#fee2e2', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 10 },
  logoutText: { color: '#dc2626', fontWeight: '700', fontSize: 15 },
});
