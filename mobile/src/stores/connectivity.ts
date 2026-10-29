import { create } from 'zustand';

type ConnectivityState = {
  /** Epoch ms of the latest fetch that failed because the API was unreachable. */
  lastFailureAt: number | null;
  /** Epoch ms of the latest successful fetch, or of the newest restored snapshot entry. */
  lastSuccessAt: number | null;
  markFailure: () => void;
  markSuccess: () => void;
  /** Seeds the success time from restored data; never moves it backwards. */
  seedSuccess: (at: number) => void;
};

/** Reachability inferred from query outcomes. App state only; it is never persisted. */
export const useConnectivityStore = create<ConnectivityState>((set) => ({
  lastFailureAt: null,
  lastSuccessAt: null,
  markFailure: () => set({ lastFailureAt: Date.now() }),
  markSuccess: () => set({ lastSuccessAt: Date.now() }),
  seedSuccess: (at) =>
    set((state) =>
      state.lastSuccessAt === null || at > state.lastSuccessAt ? { lastSuccessAt: at } : state,
    ),
}));

/** True while the latest fetch outcome is an offline failure. */
export const selectIsOffline = (state: ConnectivityState): boolean =>
  state.lastFailureAt !== null &&
  (state.lastSuccessAt === null || state.lastFailureAt > state.lastSuccessAt);
