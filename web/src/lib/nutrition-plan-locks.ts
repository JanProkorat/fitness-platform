import type { NutritionPlanDetail, MealEatenStatusDto } from '@/api/plan-types';
import { deriveMealCompletionState } from '@/lib/completionState';

/**
 * Derived "locked" sets that reflect which meals/days the client has already
 * confirmed as eaten. Trainers must not edit locked meals — past intake data
 * would be invalidated.
 *
 *   mealIds  — PlanMeal.mealId values for meals where deriveMealCompletionState
 *              returns 'eaten'.
 *   dayKeys  — `${weekNumber}:${dayOfWeek}` keys for days where EVERY planned
 *              meal in that day is locked (i.e. all are 'eaten').
 *
 * The keys are stable for a given plan + mealLogs snapshot, so memoizing on
 * `plan` and `mealLogs` in components is enough.
 */
export interface NutritionPlanLocks {
  mealIds: Set<string>;
  dayKeys: Set<string>;
}

const EMPTY_LOCKS: NutritionPlanLocks = {
  mealIds: new Set(),
  dayKeys: new Set(),
};

/**
 * Build the day key used to look up whether an entire day is locked.
 */
export function dayLockKey(weekNumber: number, dayOfWeek: number): string {
  return `${weekNumber}:${dayOfWeek}`;
}

/**
 * Compute the full lock map for a nutrition plan from its meal logs.
 * Pure function — no React, no side effects.
 *
 * @param plan      The NutritionPlanDetail (drives the meal list to check)
 * @param mealLogs  The MealEatenStatusDto[] from the same response
 */
export function computeNutritionPlanLocks(
  plan: NutritionPlanDetail | null,
  mealLogs: MealEatenStatusDto[],
): NutritionPlanLocks {
  if (!plan || mealLogs.length === 0) return EMPTY_LOCKS;

  const mealIds = new Set<string>();
  const dayKeys = new Set<string>();

  for (const week of plan.weeks) {
    for (const day of week.days) {
      if (day.meals.length === 0) continue;

      let allLocked = true;
      for (const meal of day.meals) {
        const state = deriveMealCompletionState(mealLogs, meal.mealId);
        if (state === 'eaten') {
          mealIds.add(meal.mealId);
        } else {
          allLocked = false;
        }
      }

      if (allLocked) {
        dayKeys.add(dayLockKey(week.weekNumber, day.dayOfWeek));
      }
    }
  }

  return { mealIds, dayKeys };
}
