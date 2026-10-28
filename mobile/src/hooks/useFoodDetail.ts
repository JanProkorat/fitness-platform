import { useQuery } from '@tanstack/react-query';

import { fetchFood, foodQueryKey } from '@/api/foods';

/** One food; a 404 (deleted, or not in the client's plan) is not retried. */
export function useFoodDetail(foodId: string, enabled: boolean) {
  return useQuery({
    queryKey: foodQueryKey(foodId),
    queryFn: ({ signal }) => fetchFood(foodId, signal),
    enabled,
    retry: false,
  });
}
