import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Query } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import Constants from 'expo-constants';
import Storage from 'expo-sqlite/kv-store';

import { CACHE_MAX_AGE_MS, queryClient } from '@/lib/queryClient';

const STORAGE_KEY = 'react-query-cache';

/** Top-level key segments whose whole subtree is saved. */
const PERSISTED_ROOTS: readonly unknown[] = ['me', 'plans', 'collaborations', 'conversations', 'measurements'];
/** Second segments saved under ['nutrition']; food search results are left out on purpose. */
const PERSISTED_NUTRITION: readonly unknown[] = ['plan', 'log', 'recipe', 'recipes', 'shoppingList'];

/** Allow-list matched segment by segment, so a new key is never saved by accident. */
export function isPersistedKey(queryKey: readonly unknown[]): boolean {
  const [root, second] = queryKey;
  if (PERSISTED_ROOTS.includes(root)) return true;
  if (root === 'profile') return second === 'summary';
  if (root === 'nutrition') return PERSISTED_NUTRITION.includes(second);
  return false;
}

const persister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => Storage.getItemAsync(key),
    setItem: (key, value) => Storage.setItemAsync(key, value),
    removeItem: async (key) => {
      await Storage.removeItemAsync(key);
    },
  },
  key: STORAGE_KEY,
});

/** The snapshot is dropped when the app version changes, so old shapes never reach new code. */
export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: CACHE_MAX_AGE_MS,
  buster: Constants.expoConfig?.version ?? '',
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Query) =>
      query.state.status === 'success' && isPersistedKey(query.queryKey),
  },
};

/** Newest `dataUpdatedAt` among the successful queries now in the cache, or null when there are none. */
export function newestCachedUpdate(): number | null {
  let newest: number | null = null;
  for (const query of queryClient.getQueryCache().getAll()) {
    if (query.state.status !== 'success' || query.state.dataUpdatedAt <= 0) continue;
    if (newest === null || query.state.dataUpdatedAt > newest) newest = query.state.dataUpdatedAt;
  }
  return newest;
}

/** Wipes the on-disk snapshot. Call after `queryClient.clear()` so a pending write cannot bring it back. */
export async function clearPersistedCache(): Promise<void> {
  try {
    await Storage.removeItemAsync(STORAGE_KEY);
  } catch {
    // An unreadable store holds nothing worth keeping; the next write replaces it.
  }
}
