import { useQuery } from '@tanstack/react-query';

import { fetchAllClientRecipes, recipesQueryKey } from '@/api/nutrition';

/**
 * Every recipe of one plan, or of all the client's plans when `planId` is omitted. Chips and search filter
 * this cached list on the phone, so they are not part of the key. A 404 (plan no longer visible) is not retried.
 */
export function useClientRecipes(planId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: recipesQueryKey(planId),
    queryFn: ({ signal }) => fetchAllClientRecipes(planId, signal),
    enabled,
    retry: false,
  });
}
