import { createMMKV } from 'react-native-mmkv';

const offlineStorage = createMMKV({ id: 'offline-queue' });

export interface PendingMutation {
  id: string;
  method: 'POST' | 'PUT' | 'DELETE';
  url: string;
  data?: unknown;
  createdAt: number;
}

export function getPendingMutations(): PendingMutation[] {
  const raw = offlineStorage.getString('mutations');
  return raw ? JSON.parse(raw) : [];
}

export function addPendingMutation(mutation: Omit<PendingMutation, 'id' | 'createdAt'>): void {
  const mutations = getPendingMutations();
  mutations.push({
    ...mutation,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: Date.now(),
  });
  offlineStorage.set('mutations', JSON.stringify(mutations));
}

export function removePendingMutation(id: string): void {
  const mutations = getPendingMutations().filter((m) => m.id !== id);
  offlineStorage.set('mutations', JSON.stringify(mutations));
}

export function clearPendingMutations(): void {
  offlineStorage.remove('mutations');
}
