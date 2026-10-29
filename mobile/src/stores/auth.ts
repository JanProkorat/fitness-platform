import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { isOfflineFailure } from '@/api/errors';
import { clearPersistedCache } from '@/lib/persistence';
import { queryClient } from '@/lib/queryClient';

const REFRESH_TOKEN_KEY = 'refreshToken';

interface AuthState {
  /** Access token lives in memory only. */
  accessToken: string | null;
  /** Mirror of the SecureStore value so the refresh path can read it synchronously. */
  refreshToken: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  /** Bumped on every login and logout so an in-flight refresh can tell its session ended. */
  sessionGeneration: number;
  /** Set by the check-email screen; lets a later confirmation show the Verified screen. */
  sawUnverified: boolean;
  /** Set once the user leaves the Verified screen. */
  verifiedAcknowledged: boolean;

  markSawUnverified: () => void;
  acknowledgeVerified: () => void;
  login: (accessToken: string, refreshToken: string) => Promise<void>;
  /**
   * Stores rotated tokens for the session `generation` that requested them.
   * Returns false, and keeps nothing, when that session has ended in the meantime.
   */
  applyRefreshedTokens: (
    generation: number,
    accessToken: string,
    refreshToken: string,
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

/** Puts SecureStore back in line with the in-memory token after a stale write. */
async function syncPersistedToken(refreshToken: string | null): Promise<void> {
  if (refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  } else {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isInitialized: false,
  sessionGeneration: 0,
  sawUnverified: false,
  verifiedAcknowledged: false,

  markSawUnverified: () => set({ sawUnverified: true }),
  acknowledgeVerified: () => set({ verifiedAcknowledged: true }),

  login: async (accessToken, refreshToken) => {
    // Memory first, then disk: a throttled write can otherwise bring the old user's snapshot back.
    queryClient.clear();
    await clearPersistedCache();
    // Memory first, so a stale refresh that wrote SecureStore meanwhile restores this token.
    set((state) => ({
      accessToken,
      refreshToken,
      sawUnverified: false,
      verifiedAcknowledged: false,
      sessionGeneration: state.sessionGeneration + 1,
    }));
    try {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    } catch (error) {
      set({ accessToken: null, refreshToken: null });
      throw error;
    }
    set({ isAuthenticated: true });
  },

  applyRefreshedTokens: async (generation, accessToken, refreshToken) => {
    if (get().sessionGeneration !== generation) return false;
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    if (get().sessionGeneration !== generation) {
      await syncPersistedToken(get().refreshToken);
      return false;
    }
    set({ accessToken, refreshToken });
    return true;
  },

  logout: async () => {
    // Captured before the state clears so the server-side push token can be removed as this user.
    const endingAccessToken = get().accessToken;
    set((state) => ({
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      sawUnverified: false,
      verifiedAcknowledged: false,
      sessionGeneration: state.sessionGeneration + 1,
    }));
    queryClient.clear();
    await clearPersistedCache();
    // Fire and forget, imported lazily because the API client imports this store.
    void import('@/api/pushToken')
      .then(({ unregisterPushToken }) => unregisterPushToken(endingAccessToken))
      .catch(() => undefined);
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
    } catch (error) {
      if (isOfflineFailure(error)) {
        // Unreachable API with a stored token: open the session from the saved snapshot.
        // The access token comes with the first request that gets through.
        set({ isAuthenticated: true, accessToken: null, isInitialized: true });
        return;
      }
      // A 400/401 already logged out inside executeRefresh, and the local refresh failures
      // (missing token, bad response, stale session) are not an offline start.
      set({ isInitialized: true });
    }
  },
}));
