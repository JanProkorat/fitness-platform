import { useEffect } from 'react';
import { AppState } from 'react-native';

import { drainOutbox } from '@/lib/outbox/drain';
import { reapplyAllPending, reapplyPending } from '@/lib/outbox/apply';
import { queryClient } from '@/lib/queryClient';
import { useRealtimeReconnected } from '@/realtime/useRealtimeEvent';
import { useOutboxStore } from '@/stores/outbox';

/**
 * Keeps the outbox moving while the signed-in client is on the home screens: loads it, re-applies pending writes
 * on top of every fetch, and drains on a successful query, on returning to the foreground and on a hub reconnect.
 */
export function useOutboxDrain(): void {
  useEffect(() => {
    let active = true;
    void useOutboxStore
      .getState()
      .hydrate()
      .then(() => {
        if (!active) return;
        reapplyAllPending(queryClient, useOutboxStore.getState().entries);
        void drainOutbox();
      });

    // A fetch replaces cached data, so the pending writes go back on top before anything reads it.
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'success' || event.action.manual) return;
      reapplyPending(queryClient, event.query.queryKey, useOutboxStore.getState().entries);
      void drainOutbox();
    });

    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') void drainOutbox();
    });

    return () => {
      active = false;
      unsubscribe();
      foreground.remove();
    };
  }, []);

  useRealtimeReconnected(() => {
    void drainOutbox();
  });
}
