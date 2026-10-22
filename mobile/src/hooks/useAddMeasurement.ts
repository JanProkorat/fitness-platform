import { useMutation, useQueryClient } from '@tanstack/react-query';

import { MEASUREMENTS_QUERY_KEY, addMeasurement } from '@/api/measurements';
import { PROFILE_SUMMARY_QUERY_KEY } from '@/api/profile';

/** Saves a measurement, then refreshes the measurement queries and the Profile headline numbers. */
export function useAddMeasurement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addMeasurement,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MEASUREMENTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: PROFILE_SUMMARY_QUERY_KEY });
    },
  });
}
