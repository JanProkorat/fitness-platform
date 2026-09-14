import { useMemo } from 'react'
import type { TodayTrainingResponse } from '@/api/training'
import { getOrderedSessionItems } from '@/components/training/trainingCardFormat'
import { deriveSessionCtaState } from '@/components/training/trainingCardHelpers'

/**
 * Reads multi-session completion state from the server-sourced fields on
 * `TodayTrainingResponse`.
 *
 * Source: `completedExerciseInstanceIdsBySession` — a flat, per-session set
 * of completed exercise INSTANCE ids (`SessionExercise.exerciseId`), added by
 * #877. Because every placement of an exercise in a session (nested in a
 * workout, or standalone) carries its own distinct instance id, a single flat
 * set per session is sufficient: no per-workout indirection is needed to keep
 * two placements of the same catalog exercise independent, and — unlike the
 * previous catalog-keyed `completedExerciseIdsByWorkoutAndSession` — this
 * field can represent standalone-exercise completion at all.
 *
 * This replaces the former nested `Map<sessionId, Map<sectionId, Set<catalogId>>>`
 * model and its transitional fallback outright. There is no equivalent
 * fallback here: `completedExerciseIdsBySession` /
 * `completedExerciseIdsByWorkoutAndSession` remain catalog-keyed by design
 * (kept for the web portal) and are not re-keyed into instance-id semantics.
 */
export function useCompletionState(trigger: TodayTrainingResponse | undefined) {
  const sessions = useMemo(() => trigger?.sessions ?? [], [trigger])

  // ── Flat per-session completed exercise INSTANCE ids ───────────────────────
  const completedExerciseInstanceIdsBySession = useMemo<
    ReadonlyMap<string, ReadonlySet<string>>
  >(() => {
    const result = new Map<string, ReadonlySet<string>>()
    for (const [sessionId, ids] of Object.entries(
      trigger?.completedExerciseInstanceIdsBySession ?? {},
    )) {
      result.set(sessionId, new Set(ids))
    }
    return result
  }, [trigger])

  // ── Per-session completed WORKOUT ids ──────────────────────────────────────
  // Used for workouts that don't track at the exercise level (e.g. ForTime
  // "Running"). Rename-only from the wire field `completedWorkoutIdsBySession`
  // — WorkoutId is already a per-session instance id, not a catalog id.
  const completedWorkoutIdsBySession = useMemo<Record<string, ReadonlySet<string>>>(() => {
    const result: Record<string, ReadonlySet<string>> = {}
    for (const [sessionId, ids] of Object.entries(
      trigger?.completedWorkoutIdsBySession ?? {},
    )) {
      result[sessionId] = new Set(ids)
    }
    return result
  }, [trigger])

  // A session counts as fully complete when `deriveSessionCtaState` (the
  // single source of truth for this classification, shared with the CTA
  // footer) resolves to 'finished'.
  const sessionCompleteMap = useMemo<Record<string, boolean>>(() => {
    const result: Record<string, boolean> = {}
    for (const s of sessions) {
      if (!s.sessionId) continue
      const instanceIds = completedExerciseInstanceIdsBySession.get(s.sessionId) ?? new Set<string>()
      const workoutIds = completedWorkoutIdsBySession[s.sessionId] ?? new Set<string>()
      result[s.sessionId] = deriveSessionCtaState(s, instanceIds, workoutIds) === 'finished'
    }
    return result
  }, [sessions, completedExerciseInstanceIdsBySession, completedWorkoutIdsBySession])

  /** Returns the completed exercise INSTANCE id set for a single session. */
  function completedInstanceIdsFor(sessionId: string): ReadonlySet<string> {
    return completedExerciseInstanceIdsBySession.get(sessionId) ?? new Set<string>()
  }

  /** Returns the completed-workout ID set for a single session. */
  function completedWorkoutIdsFor(sessionId: string): ReadonlySet<string> {
    return completedWorkoutIdsBySession[sessionId] ?? new Set<string>()
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
      count += (completedExerciseInstanceIdsBySession.get(s.sessionId) ?? new Set<string>()).size
    }
    return count
  }, [sessions, completedExerciseInstanceIdsBySession])

  const aggregateTotal = useMemo<number>(() => {
    let count = 0
    for (const s of sessions) {
      const exercises = getOrderedSessionItems(s).flatMap((item) => item.exercises)
      count += exercises.filter((e) => e.exerciseId != null).length
    }
    return count
  }, [sessions])

  return {
    completedExerciseInstanceIdsBySession,
    completedWorkoutIdsBySession,
    sessionCompleteMap,
    completedInstanceIdsFor,
    completedWorkoutIdsFor,
    isSessionComplete,
    aggregateDone,
    aggregateTotal,
  }
}
