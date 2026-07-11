import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  markExerciseComplete,
  markExerciseIncomplete,
  markSectionComplete,
  markSectionIncomplete,
  markSessionComplete,
  markSessionIncomplete,
  markWholeDayComplete,
  type MarkExerciseCompleteResponse,
  type MarkExerciseIncompleteResponse,
  type MarkSectionCompleteResponse,
  type MarkSectionIncompleteResponse,
  type MarkSessionCompleteResponse,
  type MarkSessionIncompleteResponse,
} from '@/api/trainingCompletion'
import type { TodayTrainingResponse, TrainingSession } from '@/api/training'

// ─── applyExerciseProgressToCache ────────────────────────────────────────────
// Standalone helper (not a method) so it can be called from mutation onSuccess
// without `this` binding issues.

/**
 * Apply a server completion response to the TanStack Query cache.
 *
 * Optimistic state (written in onMutate) is always the source of truth for
 * `completedExerciseIdsBySectionAndSession`. This function only updates
 * `versionBySession` from the response so subsequent requests use the correct
 * optimistic-concurrency token.
 *
 * The previous session-source branch that re-derived per-section completion
 * from `completedExerciseCount >= totalExerciseCount` was removed because the
 * backend counts unique catalog ids for `completedExerciseCount` but
 * `totalExerciseCount` is `Sections.SelectMany(s => s.Exercises).Count` —
 * including duplicates when the same catalog exercise appears in multiple
 * sections. This made `isSessionComplete` evaluate to false even after a
 * successful session mark, causing the for-loop to overwrite all sections with
 * empty arrays, undoing the correct optimistic state.
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

interface UseTodayTrainingActionsArgs {
  completedIdsForSection: (sessionId: string, sectionId: string) => ReadonlySet<string>
  completedSectionIdsFor: (sessionId: string) => ReadonlySet<string>
  sessionCompleteMap: Record<string, boolean>
  todaySessions: TrainingSession[]
}

/**
 * Wraps the training-completion mutation surface (single exercise, section,
 * whole session, and mark-all-day) for `HasTrainerState`. Moved verbatim out
 * of the component (#728, PR 4/4) — every onMutate/onError/onSuccess and the
 * version-token discipline is unchanged.
 */
export function useTodayTrainingActions({
  completedIdsForSection,
  completedSectionIdsFor,
  sessionCompleteMap,
  todaySessions,
}: UseTodayTrainingActionsArgs) {
  const queryClient = useQueryClient()

  // ── Mutation: toggle a single exercise complete/incomplete ─────────────────
  const toggleExerciseMutation = useMutation({
    mutationFn: async ({
      sessionId,
      sectionId,
      exerciseExternalId,
      complete,
    }: {
      sessionId: string
      sectionId: string
      exerciseExternalId: string
      complete: boolean
    }) => {
      const cache = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])
      const version = (cache?.versionBySession ?? {})[sessionId]
      const req = { version, sectionId }
      if (complete) {
        return markExerciseComplete(sessionId, exerciseExternalId, req)
      } else {
        return markExerciseIncomplete(sessionId, exerciseExternalId, req)
      }
    },
    onMutate: async ({ sessionId, sectionId, exerciseExternalId, complete }) => {
      await queryClient.cancelQueries({ queryKey: ['today-training'] })
      const previous = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])
      if (previous) {
        // Write to completedExerciseIdsBySectionAndSession so the per-section
        // set for this exact section is updated. Other sections' sets are
        // untouched — fixes the cross-section bleed bug.
        const prevBySectionAndSession = previous.completedExerciseIdsBySectionAndSession ?? {}
        const prevSessionSections: Record<string, string[]> = {
          ...(prevBySectionAndSession[sessionId] ?? {}),
        }
        const prevSectionIds: string[] = prevSessionSections[sectionId] ?? []
        const nextIdsSet = new Set(prevSectionIds)
        if (complete) {
          nextIdsSet.add(exerciseExternalId)
        } else {
          nextIdsSet.delete(exerciseExternalId)
        }
        prevSessionSections[sectionId] = Array.from(nextIdsSet)

        // NOTE: do NOT bump versionBySession here. `mutationFn` reads the
        // version from the cache after `onMutate` runs and sends it as the
        // optimistic-concurrency token; bumping it would send the wrong
        // value and cause a 409 on the server.
        //
        // When marking an exercise complete, write the planned set numbers so
        // the per-set ✓ column fills immediately. The subsequent refetch
        // reconciles with the backend's derivation.
        // When unmarking, clear that exercise's set-level entries so the
        // per-set ✓ column clears immediately (no visible flicker).
        const session = (previous.sessions ?? []).find((s) => s.sessionId === sessionId)
        const plannedEx = session?.exercises?.find((e) => e.exerciseExternalId === exerciseExternalId)
        const plannedSetNumbers = (plannedEx?.sets ?? [])
          .map((s) => s.setNumber)
          .filter((n): n is number => n != null)
          .sort((a, b) => a - b)
        const prevSessionSetsMap: Record<string, number[]> =
          previous.completedSetsBySessionExercise?.[sessionId] ?? {}
        // Only write the set-numbers entry when there are actual planned sets.
        // An empty array would produce `[exerciseExternalId]: []` in the cache —
        // cosmetically harmless but semantically wrong (backend returns no sets).
        const nextSetsForSession: Record<string, number[]> = complete
          ? {
              ...prevSessionSetsMap,
              ...(plannedSetNumbers.length > 0 ? { [exerciseExternalId]: plannedSetNumbers } : {}),
            }
          : (({ [exerciseExternalId]: _omitted, ...rest }) => rest)(prevSessionSetsMap)

        queryClient.setQueryData<TodayTrainingResponse>(['today-training'], {
          ...previous,
          completedExerciseIdsBySectionAndSession: {
            ...prevBySectionAndSession,
            [sessionId]: prevSessionSections,
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

  // ── Mutation: toggle a single section complete/incomplete ─────────────────
  // Used for sections that don't track at the exercise level (typically
  // ForTime workouts that are just a name + time cap, e.g. "Running").
  const toggleSectionMutation = useMutation({
    mutationFn: async ({
      sessionId,
      sectionId,
      complete,
    }: {
      sessionId: string
      sectionId: string
      complete: boolean
    }) => {
      const cache = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])
      const version = (cache?.versionBySession ?? {})[sessionId]
      const req = { version }
      if (complete) {
        return markSectionComplete(sessionId, sectionId, req)
      } else {
        return markSectionIncomplete(sessionId, sectionId, req)
      }
    },
    onMutate: async ({ sessionId, sectionId, complete }) => {
      await queryClient.cancelQueries({ queryKey: ['today-training'] })
      const previous = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])
      if (previous) {
        const prevIds: string[] = (previous.completedSectionIdsBySession ?? {})[sessionId] ?? []
        const nextIdsSet = new Set(prevIds)
        if (complete) nextIdsSet.add(sectionId)
        else nextIdsSet.delete(sectionId)
        queryClient.setQueryData<TodayTrainingResponse>(['today-training'], {
          ...previous,
          completedSectionIdsBySession: {
            ...(previous.completedSectionIdsBySession ?? {}),
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
        // When marking a session complete, write per-section id lists into
        // completedExerciseIdsBySectionAndSession so the per-section sets
        // reflect the full section exercise ids immediately.
        // When unmarking, clear every section's list for this session.
        // Also build planned-sets sub-map for the per-set ✓ column.
        const prevBySectionAndSession = previous.completedExerciseIdsBySectionAndSession ?? {}
        const nextSessionSections: Record<string, string[]> = {}
        const plannedSetsByEx: Record<string, number[]> = {}
        // Section-id list for the "all sections of this session are done"
        // optimistic update — required because workouts with NO trackable
        // exercises (e.g. ForTime "Beh") are marked complete via
        // `completedSectionIdsBySession`, not the per-exercise map. The
        // session-complete API response doesn't return this field, so
        // populating it here is the only thing that makes the exercise-
        // free workout flip to "done" before the next refetch.
        const allSectionIds: string[] = []

        for (const sec of session?.sections ?? []) {
          if (!sec.sectionId) continue
          const trackableIds = (sec.exercises ?? [])
            .map((e) => e.exerciseExternalId)
            .filter((id): id is string => id != null)
          nextSessionSections[sec.sectionId] = complete ? trackableIds : []
          allSectionIds.push(sec.sectionId)
        }

        // Flat planned-sets map (keyed by exId) for the per-set column.
        // Falls back to session.exercises when sections aren't available.
        for (const ex of session?.exercises ?? []) {
          const exId = ex.exerciseExternalId
          if (!exId) continue
          const nums = (ex.sets ?? [])
            .map((s) => s.setNumber)
            .filter((n): n is number => n != null)
            .sort((a, b) => a - b)
          if (nums.length > 0) plannedSetsByEx[exId] = nums
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
          completedExerciseIdsBySectionAndSession: {
            ...prevBySectionAndSession,
            [sessionId]: nextSessionSections,
          },
          completedSectionIdsBySession: {
            ...(previous.completedSectionIdsBySession ?? {}),
            // Mark every section in the session as complete (covers
            // exercise-free WOD sections like ForTime). On uncomplete,
            // clear the list so those sections flip back to "not done".
            [sessionId]: complete ? allSectionIds : [],
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
    (sessionId: string, sectionId: string, exerciseExternalId: string) => {
      const ids = completedIdsForSection(sessionId, sectionId)
      const complete = !ids.has(exerciseExternalId)
      toggleExerciseMutation.mutate({ sessionId, sectionId, exerciseExternalId, complete })
    },
    [toggleExerciseMutation, completedIdsForSection],
  )

  /**
   * Batch handler for section/workout-complete toggles.
   *
   * Unlike the sequential-mutateAsync loop it replaces, this applies ONE
   * combined optimistic setQueryData upfront so ALL exercise checkboxes flip
   * at the same instant (no sequential "wave"). HTTP requests are then issued
   * one at a time in the background, each reading the latest version token
   * from the cache after the previous response has updated it, preserving the
   * server's optimistic-concurrency invariant.
   *
   * single-exercise toggles (individual exercise row taps) still go through
   * toggleExerciseMutation — this handler is only for batch operations.
   *
   * `sectionId` is now required so each HTTP request carries the correct section
   * context, preventing cross-section bleed on the backend.
   */
  const handleToggleExercises = useCallback(
    async (sessionId: string, sectionId: string, exerciseIds: string[], complete: boolean) => {
      // ── Step 1: cancel in-flight queries and snapshot the cache ──────────
      await queryClient.cancelQueries({ queryKey: ['today-training'] })
      const previous = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])

      // ── Step 2: apply ONE combined optimistic update ──────────────────────
      if (previous) {
        const session = (previous.sessions ?? []).find((s) => s.sessionId === sessionId)

        // Write to completedExerciseIdsBySectionAndSession[sessionId][sectionId].
        const prevBySectionAndSession = previous.completedExerciseIdsBySectionAndSession ?? {}
        const prevSessionSections: Record<string, string[]> = {
          ...(prevBySectionAndSession[sessionId] ?? {}),
        }
        const prevSectionIds: string[] = prevSessionSections[sectionId] ?? []
        const nextIdsSet = new Set(prevSectionIds)

        // Build a per-exercise planned-sets map for every id in the batch,
        // mirroring the per-exercise logic in toggleExerciseMutation.onMutate
        // but applied to the whole batch at once.
        const prevSessionSetsMap: Record<string, number[]> =
          (previous.completedSetsBySessionExercise ?? {})[sessionId] ?? {}
        let nextSetsForSession: Record<string, number[]> = { ...prevSessionSetsMap }

        for (const exId of exerciseIds) {
          if (complete) {
            nextIdsSet.add(exId)
            // Write planned set numbers so per-set ✓ column fills immediately.
            const plannedEx = session?.exercises?.find((e) => e.exerciseExternalId === exId)
            const plannedSetNumbers = (plannedEx?.sets ?? [])
              .map((s) => s.setNumber)
              .filter((n): n is number => n != null)
              .sort((a, b) => a - b)
            if (plannedSetNumbers.length > 0) {
              nextSetsForSession[exId] = plannedSetNumbers
            }
          } else {
            nextIdsSet.delete(exId)
            // Remove set-level entry so per-set ✓ column clears immediately.
            const { [exId]: _omitted, ...rest } = nextSetsForSession
            nextSetsForSession = rest
          }
        }

        prevSessionSections[sectionId] = Array.from(nextIdsSet)

        // NOTE: do NOT bump versionBySession here — the server response is
        // what advances the version token (same rationale as toggleExerciseMutation).
        queryClient.setQueryData<TodayTrainingResponse>(['today-training'], {
          ...previous,
          completedExerciseIdsBySectionAndSession: {
            ...prevBySectionAndSession,
            [sessionId]: prevSessionSections,
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

      for (const exId of exerciseIds) {
        try {
          const version = (cache()?.versionBySession ?? {})[sessionId]
          const req = { version, sectionId }
          const response = complete
            ? await markExerciseComplete(sessionId, exId, req)
            : await markExerciseIncomplete(sessionId, exId, req)

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

  const handleToggleSection = useCallback(
    (sessionId: string, sectionId: string) => {
      const ids = completedSectionIdsFor(sessionId)
      const complete = !ids.has(sectionId)
      toggleSectionMutation.mutate({ sessionId, sectionId, complete })
    },
    [toggleSectionMutation, completedSectionIdsFor],
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
        const prevBySectionAndSession = previous.completedExerciseIdsBySectionAndSession ?? {}
        const nextBySectionAndSession: Record<string, Record<string, string[]>> = {
          ...prevBySectionAndSession,
        }
        const nextSetsBySessionExercise: Record<string, Record<string, number[]>> = {
          ...(previous.completedSetsBySessionExercise ?? {}),
        }

        const nextCompletedSectionIdsBySession: Record<string, string[]> = {
          ...(previous.completedSectionIdsBySession ?? {}),
        }

        for (const session of previous.sessions ?? []) {
          const sessionId = session.sessionId
          if (!sessionId) continue
          // Skip sessions that are already complete — no-op, same as toggleSession.
          if (sessionCompleteMap[sessionId]) continue

          const nextSessionSections: Record<string, string[]> = {}
          const plannedSetsByEx: Record<string, number[]> = {}

          // Collect all section IDs for this session so empty-exercise sections
          // immediately reflect as complete in the optimistic cache (#259 fix).
          const allSectionIds: string[] = (session.sections ?? [])
            .map((sec) => sec.sectionId)
            .filter((id): id is string => id != null)

          for (const sec of session.sections ?? []) {
            if (!sec.sectionId) continue
            const trackableIds = (sec.exercises ?? [])
              .map((e) => e.exerciseExternalId)
              .filter((id): id is string => id != null)
            nextSessionSections[sec.sectionId] = trackableIds
          }

          // Build planned-sets map from flat exercises list for the per-set ✓ column.
          for (const ex of session.exercises ?? []) {
            const exId = ex.exerciseExternalId
            if (!exId) continue
            const nums = (ex.sets ?? [])
              .map((s) => s.setNumber)
              .filter((n): n is number => n != null)
              .sort((a, b) => a - b)
            if (nums.length > 0) plannedSetsByEx[exId] = nums
          }

          nextBySectionAndSession[sessionId] = nextSessionSections
          nextSetsBySessionExercise[sessionId] = plannedSetsByEx
          nextCompletedSectionIdsBySession[sessionId] = allSectionIds
        }

        queryClient.setQueryData<TodayTrainingResponse>(['today-training'], {
          ...previous,
          completedExerciseIdsBySectionAndSession: nextBySectionAndSession,
          completedSetsBySessionExercise: nextSetsBySessionExercise,
          completedSectionIdsBySession: nextCompletedSectionIdsBySession,
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
    handleToggleSection,
    handleToggleSession,
    handleMarkAllTrainingDone,
    isMarkAllTrainingLoading: markAllTrainingDoneMutation.isPending,
  }
}
