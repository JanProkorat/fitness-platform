import { useMutation, useQueryClient } from '@tanstack/react-query';

import { setShoppingListItemTicked, shoppingListQueryKey } from '@/api/nutrition';
import type { ShoppingListData } from '@/api/nutrition';
import { withItemTicked } from '@/components/nutrition/shopping/model';

type TickVariables = { foodExternalId: string; isTicked: boolean };

/** Ticks or unticks an item of a week; the list changes at once and is restored if the call fails. */
export function useToggleShoppingItem(weekNumber: number) {
  const queryClient = useQueryClient();
  const queryKey = shoppingListQueryKey(weekNumber, weekNumber);
  const mutationKey = ['nutrition', 'shoppingList', 'tick', weekNumber] as const;

  return useMutation({
    mutationKey,
    mutationFn: ({ foodExternalId, isTicked }: TickVariables) =>
      setShoppingListItemTicked(weekNumber, foodExternalId, isTicked),
    onMutate: async ({ foodExternalId, isTicked }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ShoppingListData>(queryKey);
      queryClient.setQueryData<ShoppingListData>(queryKey, withItemTicked(previous, foodExternalId, isTicked));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
    },
    onSettled: () => {
      // Refetch once the last in-flight tick of this week has settled, so an older response cannot undo a newer tick.
      if (queryClient.isMutating({ mutationKey }) <= 1) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}
