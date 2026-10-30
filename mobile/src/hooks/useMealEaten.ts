import { useMutation, useQueryClient } from '@tanstack/react-query';

import { FULL_PLAN_KEY, TODAY_LOG_KEY, TODAY_PLAN_KEY, WEEK_LOG_KEY, withMealEaten } from '@/api/nutrition';
import type { NutritionMeal } from '@/api/nutrition';
import type { GetTodayLogResponse } from '@/api/generated';
import { seenItemsOf } from '@/lib/outbox/seenMeal';
import { submitWrite } from '@/lib/outbox/submit';

/**
 * Marks the meal eaten or unmarks it; the log is updated at once and rolled back if the server rejects the call.
 * Offline, the write is queued and this still resolves.
 */
export function useMealEaten(meal: NutritionMeal) {
  const queryClient = useQueryClient();
  return useMutation({
    // The outbox decides whether the call can go out; the mutation must never pause on its own.
    networkMode: 'always',
    mutationFn: (eaten: boolean) =>
      submitWrite(
        eaten
          ? // Captured now: by the time a queued write is sent, the plan cache may hold the coach's newer plan.
            { kind: 'mealEaten', payload: { mealId: meal.mealId, seenItems: seenItemsOf(meal) } }
          : { kind: 'mealUnlogged', payload: { mealId: meal.mealId } },
      ),
    onMutate: async (eaten) => {
      await queryClient.cancelQueries({ queryKey: TODAY_LOG_KEY });
      const previous = queryClient.getQueryData<GetTodayLogResponse>(TODAY_LOG_KEY);
      queryClient.setQueryData<GetTodayLogResponse>(TODAY_LOG_KEY, withMealEaten(previous, meal, eaten));
      return { previous };
    },
    onError: (_error, _eaten, context) => {
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
