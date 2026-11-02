import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  FULL_PLAN_KEY,
  TODAY_LOG_KEY,
  TODAY_PLAN_KEY,
  WEEK_LOG_KEY,
  mealItemIdsOf,
  withMealItemEaten,
} from '@/api/nutrition';
import type { NutritionMeal } from '@/api/nutrition';
import type { GetTodayLogResponse } from '@/api/generated';
import { submitWrite } from '@/lib/outbox/submit';

type ItemTick = { itemId: string; eaten: boolean };

/**
 * Ticks one item of the meal as eaten or unticks it; the log is updated at once and rolled back if the server
 * rejects the call. Offline, the write is queued and this still resolves.
 */
export function useMealItemEaten(meal: NutritionMeal) {
  const queryClient = useQueryClient();
  return useMutation({
    // The outbox decides whether the call can go out; the mutation must never pause on its own.
    networkMode: 'always',
    mutationFn: ({ itemId, eaten }: ItemTick) => {
      // Captured now: a queued write replays against a plan the coach may have changed since.
      const payload = { mealId: meal.mealId, itemId, itemIds: mealItemIdsOf(meal) };
      return submitWrite(eaten ? { kind: 'mealItemEaten', payload } : { kind: 'mealItemUnlogged', payload });
    },
    onMutate: async ({ itemId, eaten }) => {
      await queryClient.cancelQueries({ queryKey: TODAY_LOG_KEY });
      const previous = queryClient.getQueryData<GetTodayLogResponse>(TODAY_LOG_KEY);
      queryClient.setQueryData<GetTodayLogResponse>(
        TODAY_LOG_KEY,
        withMealItemEaten(previous, meal.mealId, itemId, eaten, mealItemIdsOf(meal)),
      );
      return { previous };
    },
    onError: (_error, _tick, context) => {
      queryClient.setQueryData(TODAY_LOG_KEY, context?.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: TODAY_LOG_KEY });
      void queryClient.invalidateQueries({ queryKey: TODAY_PLAN_KEY });
      void queryClient.invalidateQueries({ queryKey: FULL_PLAN_KEY });
      void queryClient.invalidateQueries({ queryKey: WEEK_LOG_KEY });
    },
  });
}
