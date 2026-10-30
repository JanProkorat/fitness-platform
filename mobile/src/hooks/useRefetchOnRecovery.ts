import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import { useRealtimeReconnected } from '@/realtime/useRealtimeEvent';
import { selectIsOffline, useConnectivityStore } from '@/stores/connectivity';

/**
 * Refetches the active queries that failed with nothing saved, once the connection is back:
 * when the hub reconnects, and when the offline flag clears. Screens showing the
 * "not saved on this phone yet" state then fill in by themselves.
 */
export function useRefetchOnRecovery(): void {
  const queryClient = useQueryClient();

  const refetchFailed = useCallback(() => {
    void queryClient.refetchQueries({
      type: 'active',
      predicate: (query) => query.state.status === 'error' && query.state.data === undefined,
    });
  }, [queryClient]);

  useRealtimeReconnected(refetchFailed);

  const isOffline = useConnectivityStore(selectIsOffline);
  const wasOffline = useRef(isOffline);
  useEffect(() => {
    if (wasOffline.current && !isOffline) refetchFailed();
    wasOffline.current = isOffline;
  }, [isOffline, refetchFailed]);
}
