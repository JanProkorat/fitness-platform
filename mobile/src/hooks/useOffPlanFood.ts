import { useMutation, useQueryClient } from '@tanstack/react-query';

import { TODAY_LOG_KEY, addOffPlanFood, removeOffPlanFood } from '@/api/nutrition';

export type AddOffPlanVariables = { foodExternalId: string; amountGrams: number };

/** Logs a food eaten outside the plan; the day log refetches so the totals and the list update. */
export function useAddOffPlanFood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ foodExternalId, amountGrams }: AddOffPlanVariables) => addOffPlanFood(foodExternalId, amountGrams),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: TODAY_LOG_KEY });
    },
  });
}

/** Removes an off-plan entry of today. */
export function useRemoveOffPlanFood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => removeOffPlanFood(entryId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: TODAY_LOG_KEY });
    },
  });
}
