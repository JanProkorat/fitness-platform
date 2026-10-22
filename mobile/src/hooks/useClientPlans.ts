import { useQuery } from '@tanstack/react-query';

import { PLANS_QUERY_KEY, fetchClientPlans } from '@/api/plans';
import { useAuthStore } from '@/stores/auth';

/** The client's own plans, active and finished. */
export function useClientPlans() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: [...PLANS_QUERY_KEY, 'list'],
    queryFn: ({ signal }) => fetchClientPlans(signal),
    enabled: isAuthenticated,
    retry: 1,
  });
}
