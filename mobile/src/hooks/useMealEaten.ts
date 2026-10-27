import { useMutation, useQueryClient } from '@tanstack/react-query';

import { FULL_PLAN_KEY, TODAY_LOG_KEY, TODAY_PLAN_KEY, setMealEaten, withMealEaten } from '@/api/nutrition';
import type { NutritionMeal } from '@/api/nutrition';
import type { GetTodayLogResponse } from '@/api/generated';

/** Marks the meal eaten or unmarks it; the log is updated at once and rolled back if the call fails. */
export function useMealEaten(meal: NutritionMeal) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eaten: boolean) => setMealEaten(meal.mealId, eaten),
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
    },
  });
}
