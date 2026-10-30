import { useMutation, useQueryClient } from '@tanstack/react-query';

import { MEASUREMENTS_QUERY_KEY, MEASUREMENT_HISTORY_QUERY_KEY } from '@/api/measurements';
import type { MeasurementEntry } from '@/api/measurements';
import { PROFILE_SUMMARY_QUERY_KEY } from '@/api/profile';
import { applyMeasurementAdded } from '@/lib/outbox/apply';
import { submitWrite } from '@/lib/outbox/submit';
import type { MeasurementPayload } from '@/lib/outbox/types';

/**
 * Saves a measurement; the history shows it at once and drops it again if the server rejects it.
 * Offline, the write is queued and this still resolves.
 */
export function useAddMeasurement() {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: (request: MeasurementPayload) => submitWrite({ kind: 'measurementAdded', payload: request }),
    onMutate: async (request) => {
      await queryClient.cancelQueries({ queryKey: MEASUREMENT_HISTORY_QUERY_KEY });
      const previous = queryClient.getQueryData<MeasurementEntry[]>(MEASUREMENT_HISTORY_QUERY_KEY);
      queryClient.setQueryData<MeasurementEntry[]>(MEASUREMENT_HISTORY_QUERY_KEY, applyMeasurementAdded(previous, request));
      return { previous };
    },
    onError: (_error, _request, context) => {
      queryClient.setQueryData(MEASUREMENT_HISTORY_QUERY_KEY, context?.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: MEASUREMENTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: PROFILE_SUMMARY_QUERY_KEY });
    },
  });
}
