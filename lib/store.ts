import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,

  setAuth: async (token: string, user: User): Promise<void> => {
    await SecureStore.setItemAsync('auth_token', token);
    await SecureStore.setItemAsync('auth_user', JSON.stringify(user));
    set({ token, user });
  },

  clearAuth: async (): Promise<void> => {
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('auth_user');
    set({ token: null, user: null });
  },

  loadAuth: async (): Promise<void> => {
    const token = await SecureStore.getItemAsync('auth_token');
    const userStr = await SecureStore.getItemAsync('auth_user');
    if (token && userStr) {
      set({ token, user: JSON.parse(userStr) as User });
    }
  },
}));
