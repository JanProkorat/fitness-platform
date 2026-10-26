import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/** Pull-to-refresh state: refetches every query, and stops spinning once they settle, errors included. */
export function usePullToRefresh() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries();
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  return { refreshing, onRefresh };
}
