import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
  Linking, Modal, ScrollView,
} from 'react-native';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function LoginScreen() {
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/login', { email, password });
      await setAuth(data.token, data.user);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Login failed. Check your credentials.';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.logo}>🌿</Text>
        <Text style={styles.title}>GHG Inventory</Text>
        <Text style={styles.subtitle}>Community-Level GHG Quantification</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor="#9ca3af"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholderTextColor="#9ca3af"
        />

        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sign In</Text>}
        </TouchableOpacity>

        {/* No registration note */}
        <View style={styles.policyBox}>
          <Text style={styles.policyText}>
            Don't have an account?{' '}
            <Text style={styles.policyLink} onPress={() => setShowPolicy(true)}>
              Contact us
            </Text>
            {' '}for access.
          </Text>
        </View>
      </View>

      {/* Policy modal */}
      <Modal visible={showPolicy} animationType="slide" transparent onRequestClose={() => setShowPolicy(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Account Access Policy</Text>
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSection}>Why can't I register?</Text>
              <Text style={styles.modalBody}>
                This app is exclusively for authorized personnel of the Local Government Unit (LGU) of Laguna. 
                Self-registration is disabled to ensure data integrity and security of the GHG Inventory System.
              </Text>

              <Text style={styles.modalSection}>Who can have an account?</Text>
              <Text style={styles.modalBody}>
                • Designated Data Collectors assigned to specific barangays{'\n'}
                • LGU administrators and validators{'\n'}
                • Authorized GHG inventory officers
              </Text>

              <Text style={styles.modalSection}>How to request access?</Text>
              <Text style={styles.modalBody}>
                Contact your LGU administrator or the GHG Inventory System coordinator to request an account. 
                Provide your full name, position, and assigned barangay.
              </Text>

              <Text style={styles.modalSection}>Contact Us</Text>
              <TouchableOpacity onPress={() => Linking.openURL('mailto:ghgi@laguna.gov.ph')}>
                <Text style={[styles.modalBody, styles.emailLink]}>📧 ghgi@laguna.gov.ph</Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity style={styles.modalClose} onPress={() => setShowPolicy(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#f0fdf4', justifyContent: 'center', padding: 24 },
  card:            { backgroundColor: '#fff', borderRadius: 16, padding: 28, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  logo:            { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  title:           { fontSize: 24, fontWeight: '700', color: '#15803d', textAlign: 'center' },
  subtitle:        { fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 28 },
  input:           { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 15, color: '#111827' },
  btn:             { backgroundColor: '#16a34a', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 4 },
  btnText:         { color: '#fff', fontWeight: '700', fontSize: 16 },
  policyBox:       { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', alignItems: 'center' },
  policyText:      { fontSize: 13, color: '#6b7280', textAlign: 'center' },
  policyLink:      { color: '#16a34a', fontWeight: '600', textDecorationLine: 'underline' },
  // Modal
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard:       { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  modalTitle:      { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 },
  modalSection:    { fontSize: 13, fontWeight: '700', color: '#15803d', marginTop: 14, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  modalBody:       { fontSize: 14, color: '#374151', lineHeight: 22 },
  emailLink:       { color: '#2563eb', textDecorationLine: 'underline', marginTop: 4 },
  modalClose:      { marginTop: 20, backgroundColor: '#f3f4f6', borderRadius: 10, padding: 14, alignItems: 'center' },
  modalCloseText:  { fontWeight: '700', color: '#374151', fontSize: 15 },
});
