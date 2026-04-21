import { useMemo } from 'react'
import type { TodayTrainingResponse } from '@/api/training'

/**
 * Reads multi-session completion state from the server-sourced fields on
 * `TodayTrainingResponse` (`completedExerciseIdsBySession`, `versionBySession`).
 *
 * Using the public response fields (instead of the old `_`-prefixed cache fields)
 * means refetches from the server re-populate completion state correctly, fixing
 * the "unset one exercise unsets all" regression caused by cache replacement on
 * refetch.
 *
 * Mutations write back to the same public fields via `setQueryData`, so optimistic
 * updates also work correctly.
 */
export function useCompletionState(trigger: TodayTrainingResponse | undefined) {
  const sessions = trigger?.sessions ?? []

  const completedIdsBySession = useMemo<Record<string, ReadonlySet<string>>>(() => {
    if (!trigger?.completedExerciseIdsBySession) return {}
    const result: Record<string, ReadonlySet<string>> = {}
    for (const [sessionId, ids] of Object.entries(trigger.completedExerciseIdsBySession)) {
      result[sessionId] = new Set(ids)
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])

  const sessionCompleteMap = useMemo<Record<string, boolean>>(() => {
    const result: Record<string, boolean> = {}
    for (const s of sessions) {
      if (!s.sessionId) continue
      const completedSet = completedIdsBySession[s.sessionId] ?? new Set<string>()
      const allExIds = (s.exercises ?? [])
        .map((e) => e.exerciseExternalId)
        .filter((id): id is string => id != null)
      result[s.sessionId] =
        allExIds.length > 0 && allExIds.every((id) => completedSet.has(id))
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedIdsBySession, sessions])

  /** Returns the completed-exercise ID set for a single session. */
  function completedIdsFor(sessionId: string): ReadonlySet<string> {
    return completedIdsBySession[sessionId] ?? new Set<string>()
  }

  /** Returns whether the whole session is marked complete. */
  function isSessionComplete(sessionId: string): boolean {
    return sessionCompleteMap[sessionId] ?? false
  }

  // Aggregate totals across all sessions (used by hero ring + StatCard chip).
  const aggregateDone = useMemo<number>(() => {
    let count = 0
    for (const s of sessions) {
      if (!s.sessionId) continue
      const ids = completedIdsBySession[s.sessionId] ?? new Set<string>()
      count += ids.size
    }
    return count
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedIdsBySession, sessions])

  const aggregateTotal = useMemo<number>(() => {
    let count = 0
    for (const s of sessions) {
      count += (s.exercises ?? []).filter((e) => e.exerciseExternalId != null).length
    }
    return count
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions])

  return {
    completedIdsBySession,
    sessionCompleteMap,
    completedIdsFor,
    isSessionComplete,
    aggregateDone,
    aggregateTotal,
  }
}
