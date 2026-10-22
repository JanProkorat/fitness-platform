import { useQuery } from '@tanstack/react-query';

import {
  MEASUREMENT_HISTORY_QUERY_KEY,
  PLAN_START_QUERY_KEY,
  fetchMeasurementHistory,
  fetchPlanStart,
} from '@/api/measurements';
import { useAuthStore } from '@/stores/auth';

/** The client's whole measurement history, newest first. */
export function useMeasurementHistory() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: MEASUREMENT_HISTORY_QUERY_KEY,
    queryFn: ({ signal }) => fetchMeasurementHistory(signal),
    enabled: isAuthenticated,
    retry: 1,
  });
}

/** Start of the earliest Active plan; a failure just hides the Plan range. */
export function usePlanStart() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: PLAN_START_QUERY_KEY,
    queryFn: ({ signal }) => fetchPlanStart(signal),
    enabled: isAuthenticated,
    retry: 1,
  });
}
