import axios from 'axios';
import { create } from 'zustand';

interface User {
  publicId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  emailConfirmed: boolean;
  avatarBlobUrl?: string | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  restoreSession: () => Promise<void>;
}

// Guard against concurrent restoreSession calls (React 18 StrictMode runs effects twice)
let restorePromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: localStorage.getItem('refreshToken'),
  isAuthenticated: false,
  isInitialized: false,

  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem('refreshToken', refreshToken);
    set({ accessToken, refreshToken });
  },

  setUser: (user) => set({ user, isAuthenticated: true }),

  login: (user, accessToken, refreshToken) => {
    localStorage.setItem('refreshToken', refreshToken);
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('refreshToken');
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  restoreSession: () => {
    if (restorePromise) return restorePromise;

    restorePromise = (async () => {
      const { refreshToken } = get();
      if (!refreshToken) {
        set({ isInitialized: true });
        return;
      }

      try {
        const { data: tokens } = await axios.post('/auth/refresh', { refreshToken });
        const newAccessToken = tokens.accessToken as string;
        const newRefreshToken = tokens.refreshToken as string;

        localStorage.setItem('refreshToken', newRefreshToken);
        set({ accessToken: newAccessToken, refreshToken: newRefreshToken });

        const { data: profile } = await axios.get('/users/me', {
          headers: { Authorization: `Bearer ${newAccessToken}` },
        });

        set({
          user: {
            publicId: profile.userId,
            email: profile.email,
            firstName: profile.firstName,
            lastName: profile.lastName,
            roles: profile.roles ?? [],
            emailConfirmed: profile.emailConfirmed ?? true,
            avatarBlobUrl: profile.avatarBlobUrl ?? null,
          },
          isAuthenticated: true,
          isInitialized: true,
        });
      } catch {
        localStorage.removeItem('refreshToken');
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isInitialized: true,
        });
      }
    })();

    return restorePromise;
  },
}));
