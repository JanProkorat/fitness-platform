import { useQuery } from '@tanstack/react-query';

import { INVITES_QUERY_KEY, fetchInvites } from '@/api/invites';
import { useAuthStore } from '@/stores/auth';

/** Pending invitations for the signed-in client; refreshed by realtime events and on foreground. */
export function useInvites() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: INVITES_QUERY_KEY,
    queryFn: ({ signal }) => fetchInvites(signal),
    enabled: isAuthenticated,
    retry: 1,
  });
}
