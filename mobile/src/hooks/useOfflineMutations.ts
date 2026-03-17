import { useEffect, useCallback } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { getPendingMutations, removePendingMutation, type PendingMutation } from '../stores/offline';
import api from '../api/client';

export function useOfflineMutations() {
  const isConnected = useNetworkStatus();

  const processMutations = useCallback(async () => {
    const mutations = getPendingMutations();
    for (const mutation of mutations) {
      try {
        await executeMutation(mutation);
        removePendingMutation(mutation.id);
      } catch {
        // Stop processing on first failure — server might be unavailable
        break;
      }
    }
  }, []);

  useEffect(() => {
    if (isConnected) {
      processMutations();
    }
  }, [isConnected, processMutations]);
}

async function executeMutation(mutation: PendingMutation): Promise<void> {
  switch (mutation.method) {
    case 'POST':
      await api.post(mutation.url, mutation.data);
      break;
    case 'PUT':
      await api.put(mutation.url, mutation.data);
      break;
    case 'DELETE':
      await api.delete(mutation.url);
      break;
  }
}
