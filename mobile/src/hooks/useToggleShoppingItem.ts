import { useMutation, useQueryClient } from '@tanstack/react-query';

import { shoppingListQueryKey } from '@/api/nutrition';
import type { ShoppingListData } from '@/api/nutrition';
import { withItemTicked } from '@/components/nutrition/shopping/model';
import { submitWrite } from '@/lib/outbox/submit';

type TickVariables = { foodExternalId: string; isTicked: boolean };

/**
 * Ticks or unticks an item of a week; the list changes at once and is restored if the server rejects the call.
 * Offline, the tick is queued and this still resolves.
 */
export function useToggleShoppingItem(weekNumber: number) {
  const queryClient = useQueryClient();
  const queryKey = shoppingListQueryKey(weekNumber, weekNumber);
  const mutationKey = ['nutrition', 'shoppingList', 'tick', weekNumber] as const;

  return useMutation({
    mutationKey,
    networkMode: 'always',
    mutationFn: ({ foodExternalId, isTicked }: TickVariables) =>
      submitWrite({ kind: 'shoppingTicked', payload: { weekNumber, foodExternalId, isTicked } }),
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
