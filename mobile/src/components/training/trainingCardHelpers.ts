/**
 * trainingCardHelpers — pure helpers for per-session CTA state derivation.
 *
 * State is derived from the client-side completion cache (`completedExerciseIds`,
 * `sessionComplete`) that is maintained by `useCompletionState` in HasTrainerState.
 * The backend's `TrainingSession / ExerciseSet` types represent planned sets only and
 * do NOT carry `completedAt`; actual completion tracking lives in the optimistic cache
 * (extended TanStack Query cache under `['today-training']`).
 *
 * The `liveSessionStore` is consulted separately by the call site to decide
 * routing behaviour — the helper only classifies state from completion data.
 */

import type { TrainingSession } from '@/api/training'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The three possible states for a training session on the Today screen.
 *
 * - `not-started` — no exercises have been marked complete.
 * - `in-progress` — at least one exercise is marked complete, but not all.
 * - `finished`    — every exercise in the session is marked complete (or there
 *                   are no exercises, in which case the session is considered
 *                   finished to avoid surfacing a useless CTA).
 */
export type SessionCtaState = 'not-started' | 'in-progress' | 'finished'

// ─── Pure helper ──────────────────────────────────────────────────────────────

/**
 * Derives the CTA state for a single training session.
 *
 * @param session             The `TrainingSession` from the API response.
 * @param completedExerciseIds The set of exerciseExternalIds that have been
 *                            marked complete in the optimistic cache.
 *
 * @returns `SessionCtaState`
 *
 * Edge cases:
 * - A session with no exercises is treated as `finished` (nothing left to do).
 * - An exercise without an `exerciseExternalId` cannot be tracked; it is
 *   excluded from both the total and completed counts so it doesn't block the
 *   `finished` state (the user can still see and log all exercises that do
 *   have IDs).
 */
export function deriveSessionCtaState(
  session: TrainingSession,
  completedExerciseIds: ReadonlySet<string>,
): SessionCtaState {
  const exercises = session.exercises ?? []

  // Only count exercises that have a trackable external ID.
  const trackable = exercises.filter(
    (ex): ex is typeof ex & { exerciseExternalId: string } =>
      ex.exerciseExternalId != null && ex.exerciseExternalId.length > 0,
  )

  if (trackable.length === 0) {
    // No trackable exercises — treat as finished so no start/continue CTA
    // is shown for an empty or un-trackable session.
    return 'finished'
  }

  const done = trackable.filter((ex) => completedExerciseIds.has(ex.exerciseExternalId)).length
  const total = trackable.length

  if (done >= total) return 'finished'
  if (done > 0) return 'in-progress'
  return 'not-started'
}
