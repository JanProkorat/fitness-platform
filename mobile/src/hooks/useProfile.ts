import { useQuery } from '@tanstack/react-query';

import { PROFILE_QUERY_KEY, fetchProfile } from '@/api/profile';
import { useAuthStore } from '@/stores/auth';

type Options = {
  /** Poll interval in ms, or false for none. The query still refetches on app foreground. */
  refetchInterval?: number | false;
};

/** The signed-in user's profile; idle while logged out. */
export function useProfile({ refetchInterval = false }: Options = {}) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: ({ signal }) => fetchProfile(signal),
    enabled: isAuthenticated,
    refetchInterval,
    retry: 1,
  });
}
