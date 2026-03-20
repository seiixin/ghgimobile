import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export const BASE_URL = 'https://ghgi-laguna.gghsoftware.tech';

const api = axios.create({
  baseURL: `${BASE_URL}/api/mobile`,
  headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Attach token on every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
