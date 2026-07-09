import { useEffect, useCallback, useRef } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { getPendingMutations, removePendingMutation, type PendingMutation } from '../stores/offline';
import api from '../api/client';

export function useOfflineMutations() {
  const isConnected = useNetworkStatus();

  // In-flight lock: prevents two overlapping processMutations() runs from
  // both reading + submitting the same queued mutation on a connectivity
  // flap (true -> false -> true while a prior run is still awaiting a
  // network call). If a run is requested while one is already active, we
  // don't drop it — we flag needsRerun and drain again once the active run
  // finishes, so a mutation queued mid-run is never left stranded.
  const isProcessingRef = useRef(false);
  const needsRerunRef = useRef(false);

  const processMutations = useCallback(async () => {
    if (isProcessingRef.current) {
      needsRerunRef.current = true;
      return;
    }

    isProcessingRef.current = true;
    try {
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
    } finally {
      isProcessingRef.current = false;
      if (needsRerunRef.current) {
        needsRerunRef.current = false;
        // A connectivity transition arrived mid-run — drain again so its
        // mutations aren't lost. Fire-and-forget; any error is handled by
        // the recursive call's own try/catch-per-mutation loop.
        void processMutations();
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
