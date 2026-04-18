import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { TodayTrainingResponse } from '@/api/training'

export type TrainingCacheWithCompletion = TodayTrainingResponse & {
  _completedIds?: Set<string>
  _sessionComplete?: boolean
  _version?: number
}

/**
 * Reads completion state (ids, session-complete flag, version) from the
 * ['today-training'] cache. Re-runs whenever that cache changes.
 *
 * The memo deps intentionally reference `trigger` (the current TodayTrainingResponse
 * from the calling component's useQuery) because TanStack's setQueryData updates
 * the same subscription that hydrates trigger — so triggering on `trigger` implicitly
 * covers every setQueryData write to this key.
 */
export function useCompletionState(trigger: TodayTrainingResponse | undefined) {
  const queryClient = useQueryClient()

  const completedExerciseIds = useMemo<ReadonlySet<string>>(() => {
    const cache = queryClient.getQueryData<TrainingCacheWithCompletion>(['today-training'])
    return cache?._completedIds ?? new Set<string>()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, queryClient])

  const sessionComplete = useMemo<boolean>(() => {
    const cache = queryClient.getQueryData<TrainingCacheWithCompletion>(['today-training'])
    return cache?._sessionComplete ?? false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, queryClient])

  return { completedExerciseIds, sessionComplete }
}
