import { useQuery } from '@tanstack/react-query';

import { getErrorStatus } from '@/api/errors';
import { FULL_PLAN_KEY, fetchFullPlan, findMeal } from '@/api/nutrition';
import type { MealLookup } from '@/api/nutrition';
import { useTodayNutritionPlan } from '@/hooks/useTodayNutritionPlan';

export type MealDetailResult =
  | { status: 'pending' }
  | { status: 'notFound' }
  | { status: 'error'; retry: () => void }
  | { status: 'ready'; lookup: MealLookup };

const isFailure = (error: unknown): boolean => error !== null && getErrorStatus(error) !== 404;

/**
 * Resolves a meal by id. There is no endpoint for a single meal, so it is looked up in today's plan
 * and, failing that, in the full plan; only a meal of today can be logged.
 */
export function useMealDetail(mealId: string, valid: boolean): MealDetailResult {
  const today = useTodayNutritionPlan();
  const inToday = valid ? findMeal(mealId, today.data, undefined) : null;
  const fullEnabled = valid && !today.isPending && inToday === null;
  const full = useQuery({
    queryKey: FULL_PLAN_KEY,
    queryFn: ({ signal }) => fetchFullPlan(signal),
    enabled: fullEnabled,
    retry: false,
  });

  if (!valid) return { status: 'notFound' };
  if (inToday) return { status: 'ready', lookup: inToday };

  if (today.isPending || full.isLoading) return { status: 'pending' };

  const inFull = findMeal(mealId, undefined, full.data);
  if (inFull) return { status: 'ready', lookup: inFull };

  if (isFailure(full.error) || isFailure(today.error)) {
    return {
      status: 'error',
      retry: () => {
        void today.refetch();
        void full.refetch();
      },
    };
  }
  return { status: 'notFound' };
}
