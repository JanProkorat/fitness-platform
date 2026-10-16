import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { queryClient } from '@/lib/queryClient';

const REFRESH_TOKEN_KEY = 'refreshToken';

interface AuthState {
  /** Access token lives in memory only. */
  accessToken: string | null;
  /** Mirror of the SecureStore value so the refresh path can read it synchronously. */
  refreshToken: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;

  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  login: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isInitialized: false,

  setTokens: async (accessToken, refreshToken) => {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    set({ accessToken, refreshToken });
  },

  login: async (accessToken, refreshToken) => {
    queryClient.clear();
    await get().setTokens(accessToken, refreshToken);
    set({ isAuthenticated: true });
  },

  logout: async () => {
    set({ accessToken: null, refreshToken: null, isAuthenticated: false });
    queryClient.clear();
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },

  restoreSession: async () => {
    try {
      const stored = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (!stored) {
        set({ isInitialized: true });
        return;
      }
      set({ refreshToken: stored });
      // Imported lazily: refresh.ts imports this store.
      const { executeRefresh } = await import('@/lib/refresh');
      await executeRefresh();
      set({ isAuthenticated: true, isInitialized: true });
    } catch {
      // A 400/401 already logged out inside executeRefresh. Any other failure
      // (network, server) keeps the stored token so the next launch can retry.
      set({ isInitialized: true });
    }
  },
}));
