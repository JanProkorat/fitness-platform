import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';

export const storage = createMMKV({ id: 'mmkv.default' });

interface User {
  publicId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: storage.getString('refreshToken') ?? null,
  isAuthenticated: false,
  isInitialized: false,

  setTokens: (accessToken, refreshToken) => {
    storage.set('refreshToken', refreshToken);
    set({ accessToken, refreshToken });
  },

  login: (user, accessToken, refreshToken) => {
    storage.set('refreshToken', refreshToken);
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },

  logout: () => {
    storage.remove('refreshToken');
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  restoreSession: async () => {
    const { refreshToken } = get();
    if (!refreshToken) {
      set({ isInitialized: true });
      return;
    }
    try {
      // Dynamic import to avoid circular dependency
      const api = (await import('../api/client')).default;
      const { data: tokens } = await api.post('/auth/refresh', { refreshToken });
      const newAccessToken = tokens.accessToken as string;
      const newRefreshToken = tokens.refreshToken as string;
      storage.set('refreshToken', newRefreshToken);
      set({ accessToken: newAccessToken, refreshToken: newRefreshToken });

      const { data: profile } = await api.get('/users/me');
      set({
        user: {
          publicId: profile.userId,
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          roles: profile.roles ?? [],
        },
        isAuthenticated: true,
        isInitialized: true,
      });
    } catch {
      storage.remove('refreshToken');
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isInitialized: true,
      });
    }
  },
}));
