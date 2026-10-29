import type { QueryKey } from '@tanstack/react-query';

import { FULL_PLAN_KEY, TODAY_PLAN_KEY, WEEK_PLAN_KEY } from '@/api/nutrition';
import { queryClient } from '@/lib/queryClient';

const PLAN_KEYS: readonly QueryKey[] = [TODAY_PLAN_KEY, WEEK_PLAN_KEY, FULL_PLAN_KEY];

const versionOf = (data: unknown): number | null => {
  if (typeof data !== 'object' || data === null) return null;
  const { planVersion } = data as { planVersion?: unknown };
  return typeof planVersion === 'number' && Number.isFinite(planVersion) ? planVersion : null;
};

/**
 * The plan version the client last saw: read from the most recently updated cached plan query, so it works
 * outside React. Null when no plan is cached.
 */
export function currentPlanVersion(): number | null {
  const cache = queryClient.getQueryCache();
  let version: number | null = null;
  let newest = -1;
  for (const queryKey of PLAN_KEYS) {
    // The queries are matched by key prefix, so every parameterised week key counts.
    for (const query of cache.findAll({ queryKey })) {
      const found = versionOf(query.state.data);
      if (found !== null && query.state.dataUpdatedAt > newest) {
        newest = query.state.dataUpdatedAt;
        version = found;
      }
    }
  }
  return version;
}
