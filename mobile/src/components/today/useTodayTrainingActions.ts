import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  markExerciseComplete,
  markExerciseIncomplete,
  markWorkoutComplete,
  markWorkoutIncomplete,
  markSessionComplete,
  markSessionIncomplete,
  markWholeDayComplete,
  type MarkExerciseCompleteResponse,
  type MarkExerciseIncompleteResponse,
  type MarkSessionCompleteResponse,
  type MarkSessionIncompleteResponse,
} from '@/api/trainingCompletion'
import type { TodayTrainingResponse, TrainingSession } from '@/api/training'
import { getOrderedSessionItems } from '@/components/training/trainingCardFormat'

// ─── applyExerciseProgressToCache ────────────────────────────────────────────
// Standalone helper (not a method) so it can be called from mutation onSuccess
// without `this` binding issues.

/**
 * Apply a server completion response to the TanStack Query cache.
 *
 * Optimistic state (written in onMutate) is always the source of truth for
 * `completedExerciseInstanceIdsBySession`. This function only updates
 * `versionBySession` from the response so subsequent requests use the correct
 * optimistic-concurrency token.
 */
function applyExerciseProgressToCache(
  queryClient: ReturnType<typeof useQueryClient>,
  sessionId: string,
  response:
    | MarkExerciseCompleteResponse
    | MarkExerciseIncompleteResponse
    | MarkSessionCompleteResponse
    | MarkSessionIncompleteResponse,
): void {
  queryClient.setQueryData<TodayTrainingResponse>(['today-training'], (prev) => {
    if (!prev) return prev

    const prevVersion = (prev.versionBySession ?? {})[sessionId] ?? 1

    return {
      ...prev,
      versionBySession: {
        ...(prev.versionBySession ?? {}),
        [sessionId]: response.version ?? prevVersion,
      },
    }
  })
}

/**
 * Flattens a session's ordered items (workouts + standalone exercises,
 * interleaved by `order`) into its exercise list. Used wherever this hook
 * needs "every exercise in the session" without caring about render order.
 */
function allSessionExercises(session: TrainingSession) {
  return getOrderedSessionItems(session).flatMap((item) => item.exercises)
}

interface UseTodayTrainingActionsArgs {
  completedInstanceIdsFor: (sessionId: string) => ReadonlySet<string>
  completedWorkoutIdsFor: (sessionId: string) => ReadonlySet<string>
  sessionCompleteMap: Record<string, boolean>
  todaySessions: TrainingSession[]
}

/**
 * Wraps the training-completion mutation surface (single exercise, workout,
 * whole session, and mark-all-day) for `HasTrainerState`.
 *
 * Every exercise-level operation addresses the per-instance `exerciseId`
 * (`SessionExercise.exerciseId`), not the catalog `exerciseExternalId` — the
 * mark-complete/incomplete routes resolve against the session's instance ids,
 * which is what lets two placements of the same catalog exercise in one
 * session (nested + standalone, or nested twice) be completed independently.
 * `completedSetsBySessionExercise` remains catalog-keyed by design (shared
 * wire semantics with the web portal) and is populated by catalog id even
 * though the completion signal itself is instance-keyed.
 */
export function useTodayTrainingActions({
  completedInstanceIdsFor,
  completedWorkoutIdsFor,
  sessionCompleteMap,
  todaySessions,
}: UseTodayTrainingActionsArgs) {
  const queryClient = useQueryClient()

  // ── Mutation: toggle a single exercise instance complete/incomplete ───────
  const toggleExerciseMutation = useMutation({
    mutationFn: async ({
      sessionId,
      exerciseId,
      complete,
    }: {
      sessionId: string
      exerciseId: string
      complete: boolean
    }) => {
      const cache = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])
      const version = (cache?.versionBySession ?? {})[sessionId]
      const req = { version }
      if (complete) {
        return markExerciseComplete(sessionId, exerciseId, req)
      } else {
        return markExerciseIncomplete(sessionId, exerciseId, req)
      }
    },
    onMutate: async ({ sessionId, exerciseId, complete }) => {
      await queryClient.cancelQueries({ queryKey: ['today-training'] })
      const previous = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])
      if (previous) {
        const prevInstanceIdsBySession = previous.completedExerciseInstanceIdsBySession ?? {}
        const nextIdsSet = new Set(prevInstanceIdsBySession[sessionId] ?? [])
        if (complete) {
          nextIdsSet.add(exerciseId)
        } else {
          nextIdsSet.delete(exerciseId)
        }

        // NOTE: do NOT bump versionBySession here. `mutationFn` reads the
        // version from the cache after `onMutate` runs and sends it as the
        // optimistic-concurrency token; bumping it would send the wrong
        // value and cause a 409 on the server.
        //
        // When marking an exercise complete, write the planned set numbers
        // (keyed by the CATALOG id — completedSetsBySessionExercise stays
        // catalog-keyed by design) so the per-set ✓ column fills
        // immediately. The subsequent refetch reconciles with the backend's
        // derivation. When unmarking, clear that exercise's set-level
        // entries so the per-set ✓ column clears immediately (no flicker).
        const session = (previous.sessions ?? []).find((s) => s.sessionId === sessionId)
        const plannedEx = session ? allSessionExercises(session).find((e) => e.exerciseId === exerciseId) : undefined
        const catalogId = plannedEx?.exerciseExternalId
        const plannedSetNumbers = (plannedEx?.sets ?? [])
          .map((s) => s.setNumber)
          .filter((n): n is number => n != null)
          .sort((a, b) => a - b)
        const prevSessionSetsMap: Record<string, number[]> =
          previous.completedSetsBySessionExercise?.[sessionId] ?? {}
        // Only write the set-numbers entry when there are actual planned sets.
        const nextSetsForSession: Record<string, number[]> =
          complete && catalogId
            ? {
                ...prevSessionSetsMap,
                ...(plannedSetNumbers.length > 0 ? { [catalogId]: plannedSetNumbers } : {}),
              }
            : catalogId
              ? (({ [catalogId]: _omitted, ...rest }) => rest)(prevSessionSetsMap)
              : prevSessionSetsMap

        queryClient.setQueryData<TodayTrainingResponse>(['today-training'], {
          ...previous,
          completedExerciseInstanceIdsBySession: {
            ...prevInstanceIdsBySession,
            [sessionId]: Array.from(nextIdsSet),
          },
          completedSetsBySessionExercise: {
            ...(previous.completedSetsBySessionExercise ?? {}),
            [sessionId]: nextSetsForSession,
          },
        })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['today-training'], context.previous)
      }
      queryClient.invalidateQueries({ queryKey: ['today-training'] })
    },
    onSuccess: (response, { sessionId }) => {
      applyExerciseProgressToCache(queryClient, sessionId, response)
      queryClient.invalidateQueries({ queryKey: ['compliance-score'] })
    },
  })

  // ── Mutation: toggle a single workout complete/incomplete ─────────────────
  // Used for workouts that don't track at the exercise level (typically
  // ForTime workouts that are just a name + time cap, e.g. "Running").
  const toggleWorkoutMutation = useMutation({
    mutationFn: async ({
      sessionId,
      workoutId,
      complete,
    }: {
      sessionId: string
      workoutId: string
      complete: boolean
    }) => {
      const cache = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])
      const version = (cache?.versionBySession ?? {})[sessionId]
      const req = { version }
      if (complete) {
        return markWorkoutComplete(sessionId, workoutId, req)
      } else {
        return markWorkoutIncomplete(sessionId, workoutId, req)
      }
    },
    onMutate: async ({ sessionId, workoutId, complete }) => {
      await queryClient.cancelQueries({ queryKey: ['today-training'] })
      const previous = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])
      if (previous) {
        const prevIds: string[] = (previous.completedWorkoutIdsBySession ?? {})[sessionId] ?? []
        const nextIdsSet = new Set(prevIds)
        if (complete) nextIdsSet.add(workoutId)
        else nextIdsSet.delete(workoutId)
        queryClient.setQueryData<TodayTrainingResponse>(['today-training'], {
          ...previous,
          completedWorkoutIdsBySession: {
            ...(previous.completedWorkoutIdsBySession ?? {}),
            [sessionId]: Array.from(nextIdsSet),
          },
        })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['today-training'], context.previous)
      }
      queryClient.invalidateQueries({ queryKey: ['today-training'] })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-score'] })
    },
  })

  // ── Mutation: toggle the entire session complete/incomplete ───────────────
  const toggleSessionMutation = useMutation({
    mutationFn: async ({ sessionId, complete }: { sessionId: string; complete: boolean }) => {
      const cache = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])
      const version = (cache?.versionBySession ?? {})[sessionId]
      const req = { version }
      if (complete) {
        return markSessionComplete(sessionId, req)
      } else {
        return markSessionIncomplete(sessionId, req)
      }
    },
    onMutate: async ({ sessionId, complete }) => {
      await queryClient.cancelQueries({ queryKey: ['today-training'] })
      const previous = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])
      if (previous) {
        const session = (previous.sessions ?? []).find((s) => s.sessionId === sessionId)
        // NOTE: do NOT bump versionBySession here (see toggleExerciseMutation
        // for the full rationale).
        //
        // When marking a session complete, write every trackable instance id
        // in the session into completedExerciseInstanceIdsBySession, and
        // every real workout id into completedWorkoutIdsBySession (covers
        // exercise-free WOD workouts like ForTime "Beh"). When unmarking,
        // clear both for this session. Also build the catalog-keyed
        // planned-sets sub-map for the per-set ✓ column.
        const exercises = session ? allSessionExercises(session) : []
        const trackableInstanceIds = exercises
          .map((e) => e.exerciseId)
          .filter((id): id is string => id != null)
        const allWorkoutIds: string[] = (session?.workouts ?? [])
          .map((w) => w.workoutId)
          .filter((id): id is string => id != null)

        const plannedSetsByEx: Record<string, number[]> = {}
        for (const ex of exercises) {
          const catalogId = ex.exerciseExternalId
          if (!catalogId) continue
          const nums = (ex.sets ?? [])
            .map((s) => s.setNumber)
            .filter((n): n is number => n != null)
            .sort((a, b) => a - b)
          if (nums.length > 0) plannedSetsByEx[catalogId] = nums
        }

        const nextSetsForSession: Record<string, Record<string, number[]>> = complete
          ? {
              ...(previous.completedSetsBySessionExercise ?? {}),
              [sessionId]: plannedSetsByEx,
            }
          : {
              ...(previous.completedSetsBySessionExercise ?? {}),
              [sessionId]: {},
            }

        queryClient.setQueryData<TodayTrainingResponse>(['today-training'], {
          ...previous,
          completedExerciseInstanceIdsBySession: {
            ...(previous.completedExerciseInstanceIdsBySession ?? {}),
            [sessionId]: complete ? trackableInstanceIds : [],
          },
          completedWorkoutIdsBySession: {
            ...(previous.completedWorkoutIdsBySession ?? {}),
            [sessionId]: complete ? allWorkoutIds : [],
          },
          completedSetsBySessionExercise: nextSetsForSession,
        })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['today-training'], context.previous)
      }
      queryClient.invalidateQueries({ queryKey: ['today-training'] })
    },
    onSuccess: (response, { sessionId }) => {
      applyExerciseProgressToCache(queryClient, sessionId, response)
      queryClient.invalidateQueries({ queryKey: ['compliance-score'] })
    },
  })

  const handleToggleExercise = useCallback(
    (sessionId: string, exerciseId: string) => {
      const ids = completedInstanceIdsFor(sessionId)
      const complete = !ids.has(exerciseId)
      toggleExerciseMutation.mutate({ sessionId, exerciseId, complete })
    },
    [toggleExerciseMutation, completedInstanceIdsFor],
  )

  /**
   * Batch handler for workout-complete toggles (marking every exercise in a
   * workout at once).
   *
   * Unlike a sequential-mutateAsync loop, this applies ONE combined
   * optimistic setQueryData upfront so ALL exercise checkboxes flip at the
   * same instant (no sequential "wave"). HTTP requests are then issued one
   * at a time in the background, each reading the latest version token from
   * the cache after the previous response has updated it, preserving the
   * server's optimistic-concurrency invariant.
   *
   * Single-exercise toggles (individual exercise row taps) still go through
   * toggleExerciseMutation — this handler is only for batch operations.
   */
  const handleToggleExercises = useCallback(
    async (sessionId: string, exerciseIds: string[], complete: boolean) => {
      // ── Step 1: cancel in-flight queries and snapshot the cache ──────────
      await queryClient.cancelQueries({ queryKey: ['today-training'] })
      const previous = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])

      // ── Step 2: apply ONE combined optimistic update ──────────────────────
      if (previous) {
        const session = (previous.sessions ?? []).find((s) => s.sessionId === sessionId)
        const exercises = session ? allSessionExercises(session) : []

        const prevInstanceIdsBySession = previous.completedExerciseInstanceIdsBySession ?? {}
        const nextIdsSet = new Set(prevInstanceIdsBySession[sessionId] ?? [])

        // Build a per-exercise planned-sets map (keyed by CATALOG id) for
        // every id in the batch, mirroring the per-exercise logic in
        // toggleExerciseMutation.onMutate but applied to the whole batch.
        const prevSessionSetsMap: Record<string, number[]> =
          (previous.completedSetsBySessionExercise ?? {})[sessionId] ?? {}
        let nextSetsForSession: Record<string, number[]> = { ...prevSessionSetsMap }

        for (const exerciseId of exerciseIds) {
          if (complete) {
            nextIdsSet.add(exerciseId)
            // Write planned set numbers so per-set ✓ column fills immediately.
            const plannedEx = exercises.find((e) => e.exerciseId === exerciseId)
            const catalogId = plannedEx?.exerciseExternalId
            const plannedSetNumbers = (plannedEx?.sets ?? [])
              .map((s) => s.setNumber)
              .filter((n): n is number => n != null)
              .sort((a, b) => a - b)
            if (catalogId && plannedSetNumbers.length > 0) {
              nextSetsForSession[catalogId] = plannedSetNumbers
            }
          } else {
            nextIdsSet.delete(exerciseId)
            // Remove set-level entry so per-set ✓ column clears immediately.
            const plannedEx = exercises.find((e) => e.exerciseId === exerciseId)
            const catalogId = plannedEx?.exerciseExternalId
            if (catalogId) {
              const { [catalogId]: _omitted, ...rest } = nextSetsForSession
              nextSetsForSession = rest
            }
          }
        }

        // NOTE: do NOT bump versionBySession here — the server response is
        // what advances the version token (same rationale as toggleExerciseMutation).
        queryClient.setQueryData<TodayTrainingResponse>(['today-training'], {
          ...previous,
          completedExerciseInstanceIdsBySession: {
            ...prevInstanceIdsBySession,
            [sessionId]: Array.from(nextIdsSet),
          },
          completedSetsBySessionExercise: {
            ...(previous.completedSetsBySessionExercise ?? {}),
            [sessionId]: nextSetsForSession,
          },
        })
      }

      // ── Step 3: serialize HTTP requests in the background ─────────────────
      // Read the version from cache before each request — applyExerciseProgressToCache
      // in step 4 updates it after each response, so the next request sees the
      // correct token and avoids 409s.
      const cache = () => queryClient.getQueryData<TodayTrainingResponse>(['today-training'])

      for (const exerciseId of exerciseIds) {
        try {
          const version = (cache()?.versionBySession ?? {})[sessionId]
          const req = { version }
          const response = complete
            ? await markExerciseComplete(sessionId, exerciseId, req)
            : await markExerciseIncomplete(sessionId, exerciseId, req)

          // ── Step 5: apply server response to cache after each success ────
          // Same as toggleExerciseMutation.onSuccess — updates versionBySession
          // so the next iteration reads the correct token.
          applyExerciseProgressToCache(queryClient, sessionId, response)
        } catch {
          // ── Step 6: on error, restore snapshot and stop ──────────────────
          if (previous) {
            queryClient.setQueryData(['today-training'], previous)
          }
          queryClient.invalidateQueries({ queryKey: ['today-training'] })
          break
        }
      }

      // ── Step 7: invalidate compliance score once after the whole batch ────
      queryClient.invalidateQueries({ queryKey: ['compliance-score'] })
    },
    [queryClient],
  )

  const handleToggleWorkout = useCallback(
    (sessionId: string, workoutId: string) => {
      const ids = completedWorkoutIdsFor(sessionId)
      const complete = !ids.has(workoutId)
      toggleWorkoutMutation.mutate({ sessionId, workoutId, complete })
    },
    [toggleWorkoutMutation, completedWorkoutIdsFor],
  )

  const handleToggleSession = useCallback(
    (sessionId: string) => {
      const isComplete = sessionCompleteMap[sessionId] ?? false
      toggleSessionMutation.mutate({ sessionId, complete: !isComplete })
    },
    [toggleSessionMutation, sessionCompleteMap],
  )

  // ── Mutation: mark every training session for the day complete ─────────────
  const markAllTrainingDoneMutation = useMutation({
    mutationFn: () => markWholeDayComplete({}),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['today-training'] })
      const previous = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])
      if (previous) {
        const nextInstanceIdsBySession: Record<string, string[]> = {
          ...(previous.completedExerciseInstanceIdsBySession ?? {}),
        }
        const nextSetsBySessionExercise: Record<string, Record<string, number[]>> = {
          ...(previous.completedSetsBySessionExercise ?? {}),
        }
        const nextCompletedWorkoutIdsBySession: Record<string, string[]> = {
          ...(previous.completedWorkoutIdsBySession ?? {}),
        }

        for (const session of previous.sessions ?? []) {
          const sessionId = session.sessionId
          if (!sessionId) continue
          // Skip sessions that are already complete — no-op, same as toggleSession.
          if (sessionCompleteMap[sessionId]) continue

          const exercises = allSessionExercises(session)
          const trackableInstanceIds = exercises
            .map((e) => e.exerciseId)
            .filter((id): id is string => id != null)

          // Collect all real workout IDs for this session so empty-exercise
          // workouts immediately reflect as complete in the optimistic cache.
          const allWorkoutIds: string[] = (session.workouts ?? [])
            .map((w) => w.workoutId)
            .filter((id): id is string => id != null)

          const plannedSetsByEx: Record<string, number[]> = {}
          for (const ex of exercises) {
            const catalogId = ex.exerciseExternalId
            if (!catalogId) continue
            const nums = (ex.sets ?? [])
              .map((s) => s.setNumber)
              .filter((n): n is number => n != null)
              .sort((a, b) => a - b)
            if (nums.length > 0) plannedSetsByEx[catalogId] = nums
          }

          nextInstanceIdsBySession[sessionId] = trackableInstanceIds
          nextSetsBySessionExercise[sessionId] = plannedSetsByEx
          nextCompletedWorkoutIdsBySession[sessionId] = allWorkoutIds
        }

        queryClient.setQueryData<TodayTrainingResponse>(['today-training'], {
          ...previous,
          completedExerciseInstanceIdsBySession: nextInstanceIdsBySession,
          completedSetsBySessionExercise: nextSetsBySessionExercise,
          completedWorkoutIdsBySession: nextCompletedWorkoutIdsBySession,
        })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['today-training'], context.previous)
      }
      queryClient.invalidateQueries({ queryKey: ['today-training'] })
    },
    onSuccess: (response) => {
      // Write the server's new per-session version tokens back into the cache.
      // Unlike the per-session mutations (which call applyExerciseProgressToCache),
      // the whole-day mark used to discard the response versions — leaving
      // versionBySession stale. The next per-session mark/un-mark then sent an
      // outdated optimistic-concurrency token → backend 409 → onError rolled the
      // un-mark back to the complete state and refetched, so un-marking appeared
      // to "snap back" to finished (#739).
      const summaries = response.sessions ?? []
      if (summaries.length > 0) {
        queryClient.setQueryData<TodayTrainingResponse>(['today-training'], (prev) => {
          if (!prev) return prev
          const nextVersions = { ...(prev.versionBySession ?? {}) }
          for (const summary of summaries) {
            if (summary.sessionId != null && summary.version != null) {
              nextVersions[summary.sessionId] = summary.version
            }
          }
          return { ...prev, versionBySession: nextVersions }
        })
      }
      queryClient.invalidateQueries({ queryKey: ['compliance-score'] })
    },
  })

  const handleMarkAllTrainingDone = useCallback(() => {
    // Skip if every session is already marked complete.
    const hasIncomplete = todaySessions.some(
      (s) => s.sessionId != null && !sessionCompleteMap[s.sessionId],
    )
    if (!hasIncomplete) return
    markAllTrainingDoneMutation.mutate()
  }, [todaySessions, sessionCompleteMap, markAllTrainingDoneMutation])

  return {
    handleToggleExercise,
    handleToggleExercises,
    handleToggleWorkout,
    handleToggleSession,
    handleMarkAllTrainingDone,
    isMarkAllTrainingLoading: markAllTrainingDoneMutation.isPending,
  }
}
