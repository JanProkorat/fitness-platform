import { useQuery } from '@tanstack/react-query';

import { PAYMENTS_QUERY_KEY, fetchPayments } from '@/api/payments';
import { useAuthStore } from '@/stores/auth';

/**
 * What the client owes and has paid, grouped by coach. Pass `enabled: false` while payments are
 * hidden so nothing about them is fetched; refreshed by realtime events and on foreground.
 */
export function usePayments(enabled = true) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: PAYMENTS_QUERY_KEY,
    queryFn: ({ signal }) => fetchPayments(signal),
    enabled: isAuthenticated && enabled,
    retry: 1,
  });
}
