import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';

export const storage = createMMKV({ id: 'mmkv.default' });

interface User {
  publicId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  isOnboardingComplete: boolean | null;
  emailConfirmed: boolean;
  hasActiveLink: boolean;
  hasPendingQuestionnaire: boolean;
  linkedRoles: string[];
}

// ─── Collaboration types ─────────────────────────────────────────────

export interface ActiveCollaborator {
  id: string;
  name: string;
  initials: string;
  role: string;
  city: string;
  since: string;
  avatarColor: string;
  avatarBg: string;
}

export interface TrainerInvite {
  id: string;
  trainerId: string;
  trainerName: string;
  trainerInitials: string;
  trainerRole: string;
  trainerCity: string;
  message: string;
  price: number;
  pricePeriod: string;
  sentAt: string;
}

export interface PendingRequest {
  id: string;
  trainerId: string;
  name: string;
  initials: string;
  role: string;
  city: string;
  avatarColor: string;
  avatarBg: string;
  sentAt: string;
}

export type CollabState = 'none' | 'trainer' | 'coach' | 'both';

export function getCollabState(hasTrainer: boolean, hasCoach: boolean): CollabState {
  if (hasTrainer && hasCoach) return 'both';
  if (hasTrainer) return 'trainer';
  if (hasCoach) return 'coach';
  return 'none';
}

// ─── Auth store ──────────────────────────────────────────────────────

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;

  // Collaboration state
  hasTrainer: boolean;
  hasCoach: boolean;
  trainer: ActiveCollaborator | null;
  coach: ActiveCollaborator | null;
  pendingInvite: TrainerInvite | null;
  pendingRequests: PendingRequest[];

  // Auth actions
  setTokens: (accessToken: string, refreshToken: string) => void;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  restoreSession: () => Promise<void>;
  refreshProfile: () => Promise<void>;

  // Collaboration actions
  setTrainer: (trainer: ActiveCollaborator | null) => void;
  setCoach: (coach: ActiveCollaborator | null) => void;
  setHasTrainer: (v: boolean) => void;
  setHasCoach: (v: boolean) => void;
  setPendingInvite: (invite: TrainerInvite | null) => void;
  setPendingRequests: (requests: PendingRequest[]) => void;
  addPendingRequest: (request: PendingRequest) => void;
  removePendingRequest: (id: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: storage.getString('refreshToken') ?? null,
  isAuthenticated: false,
  isInitialized: false,

  // Collaboration defaults
  hasTrainer: false,
  hasCoach: false,
  trainer: null,
  coach: null,
  pendingInvite: null,
  pendingRequests: [],

  setTokens: (accessToken, refreshToken) => {
    storage.set('refreshToken', refreshToken);
    set({ accessToken, refreshToken });
  },

  login: (user, accessToken, refreshToken) => {
    storage.set('refreshToken', refreshToken);
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },

  logout: () => {
    // Clear all persisted and in-memory caches to prevent data leaking between users
    storage.clearAll();
    import('../stores/todayStore').then(({ useTodayStore }) => {
      useTodayStore.getState().reset();
    });
    import('../stores/offline').then(({ clearPendingMutations }) => {
      clearPendingMutations();
    });
    import('../lib/queryClient').then(({ queryClient }) => {
      queryClient.clear();
    });
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      hasTrainer: false,
      hasCoach: false,
      trainer: null,
      coach: null,
      pendingInvite: null,
      pendingRequests: [],
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
          isOnboardingComplete: profile.isOnboardingComplete ?? null,
          emailConfirmed: profile.emailConfirmed ?? false,
          hasActiveLink: profile.hasActiveLink ?? false,
          hasPendingQuestionnaire: profile.hasPendingQuestionnaire ?? false,
          linkedRoles: profile.linkedRoles ?? [],
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

  refreshProfile: async () => {
    const { accessToken } = get();
    if (!accessToken) return;
    try {
      const api = (await import('../api/client')).default;
      const { data: profile } = await api.get('/users/me');
      set({
        user: {
          publicId: profile.userId,
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          roles: profile.roles ?? [],
          isOnboardingComplete: profile.isOnboardingComplete ?? null,
          emailConfirmed: profile.emailConfirmed ?? false,
          hasActiveLink: profile.hasActiveLink ?? false,
          hasPendingQuestionnaire: profile.hasPendingQuestionnaire ?? false,
          linkedRoles: profile.linkedRoles ?? [],
        },
      });
    } catch {
      // silently fail - user can retry
    }
  },

  // Collaboration actions
  setTrainer: (trainer) => set({ trainer, hasTrainer: trainer !== null }),
  setCoach: (coach) => set({ coach, hasCoach: coach !== null }),
  setHasTrainer: (v) => set({ hasTrainer: v, ...(!v && { trainer: null }) }),
  setHasCoach: (v) => set({ hasCoach: v, ...(!v && { coach: null }) }),
  setPendingInvite: (invite) => set({ pendingInvite: invite }),
  setPendingRequests: (requests) => set({ pendingRequests: requests }),
  addPendingRequest: (request) =>
    set((s) => ({ pendingRequests: [...s.pendingRequests, request] })),
  removePendingRequest: (id) =>
    set((s) => ({ pendingRequests: s.pendingRequests.filter((r) => r.id !== id) })),
}));
