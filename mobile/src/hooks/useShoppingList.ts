import { useQuery } from '@tanstack/react-query';

import { fetchShoppingList, shoppingListQueryKey } from '@/api/nutrition';

/** The shopping list of one plan week; a client without an active plan gets a 404, so it is not retried. */
export function useShoppingList(weekNumber: number) {
  return useQuery({
    queryKey: shoppingListQueryKey(weekNumber, weekNumber),
    queryFn: ({ signal }) => fetchShoppingList(weekNumber, weekNumber, signal),
    retry: false,
  });
}
