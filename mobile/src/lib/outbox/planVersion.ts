import type { Query } from '@tanstack/react-query';

import { FULL_PLAN_KEY, TODAY_PLAN_KEY, WEEK_PLAN_KEY } from '@/api/nutrition';
import { queryClient } from '@/lib/queryClient';
import type { OutboxWrite } from '@/lib/outbox/types';

const PLAN_ROOT_KEY = ['nutrition', 'plan'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const versionOf = (data: unknown): number | null => {
  if (!isRecord(data)) return null;
  const { planVersion } = data;
  return typeof planVersion === 'number' && Number.isFinite(planVersion) ? planVersion : null;
};

const hasMeal = (meals: unknown, mealId: string): boolean =>
  Array.isArray(meals) && meals.some((meal) => isRecord(meal) && meal.mealId === mealId);

const hasMealInDays = (days: unknown, mealId: string): boolean =>
  Array.isArray(days) && days.some((day) => isRecord(day) && hasMeal(day.meals, mealId));

/** True when a cached plan response (today, week or full shape) holds the meal. */
function containsMeal(data: unknown, mealId: string): boolean {
  if (!isRecord(data)) return false;
  if (hasMeal(data.meals, mealId) || hasMealInDays(data.days, mealId)) return true;
  return Array.isArray(data.weeks) && data.weeks.some((week) => isRecord(week) && hasMealInDays(week.days, mealId));
}

/** The version of the newest-updated query among those given that passes `accept`; null when none does. */
function newestVersion(queries: Query[], accept: (data: unknown) => boolean): number | null {
  let version: number | null = null;
  let newest = -1;
  for (const query of queries) {
    const found = versionOf(query.state.data);
    if (found !== null && accept(query.state.data) && query.state.dataUpdatedAt > newest) {
      newest = query.state.dataUpdatedAt;
      version = found;
    }
  }
  return version;
}

const mealIdOf = (write: OutboxWrite): string | null =>
  write.kind === 'mealEaten' || write.kind === 'mealUnlogged' ? write.payload.mealId : null;

/**
 * The plan version the client last saw for a write, read from the query cache so it works outside React.
 * A meal write takes the version of the cached plan that holds that meal (a finished plan opened from the
 * profile must not stand in for the active one); any other write takes the client's active plan. Null when
 * no matching plan is cached.
 */
export function currentPlanVersion(write: OutboxWrite): number | null {
  const cache = queryClient.getQueryCache();
  const mealId = mealIdOf(write);
  if (mealId !== null) {
    return newestVersion(cache.findAll({ queryKey: PLAN_ROOT_KEY }), (data) => containsMeal(data, mealId));
  }
  // The today and week reads always describe the active plan; the unkeyed full read is the active plan too,
  // while the by-id entries under the same prefix may be finished plans.
  const active = [
    ...cache.findAll({ queryKey: TODAY_PLAN_KEY }),
    ...cache.findAll({ queryKey: WEEK_PLAN_KEY }),
    ...cache.findAll({ queryKey: FULL_PLAN_KEY, exact: true }),
  ];
  return newestVersion(active, () => true);
}
