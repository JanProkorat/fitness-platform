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
 * Section-aware: exercises are counted per-section so that the same catalog
 * exercise appearing in multiple sections (e.g. in W1 and W3) is only treated
 * as complete in a given section when that section's own completion set
 * contains the id. Marking it done in W1 no longer satisfies W3's instance.
 *
 * @param session                  The `TrainingSession` from the API response.
 * @param completedIdsBySection    Per-section completion map for this session:
 *                                 sectionId → Set<exerciseExternalId>.
 *                                 Exercises are counted against the set for
 *                                 the section they belong to.
 * @param completedSectionIds      The set of sectionIds that have been marked
 *                                 complete as a whole (used for sections that
 *                                 have no trackable exercises, e.g. a ForTime
 *                                 "Running" section).
 * @param hasActiveLiveSession     When true, the user has an in-flight live
 *                                 session for this session that has not yet
 *                                 been finished. A `not-started` state is
 *                                 bumped to `in-progress` so the CTA reads
 *                                 "Continue training" as soon as the user
 *                                 starts the session (even before any full
 *                                 exercise is marked complete via the
 *                                 checkbox). `finished` is never overridden
 *                                 by this flag.
 *
 * @returns `SessionCtaState`
 *
 * Edge cases:
 * - A session with no sections AND no exercises is treated as `finished`.
 * - An exercise without an `exerciseExternalId` cannot be tracked; it is
 *   excluded from both the total and completed counts so it doesn't block the
 *   `finished` state.
 * - A section with zero trackable exercises is counted as 1 unit. It
 *   contributes 1 to `total` and 1 to `done` only if its `sectionId` is
 *   present in `completedSectionIds`. This handles ForTime/AMRAP sections
 *   that consist entirely of a time-cap task with no individual exercises.
 */
export function deriveSessionCtaState(
  session: TrainingSession,
  completedIdsBySection: ReadonlyMap<string, ReadonlySet<string>>,
  completedSectionIds: ReadonlySet<string>,
  hasActiveLiveSession = false,
): SessionCtaState {
  const exercises = session.exercises ?? []
  const sections = session.sections ?? []

  // Truly empty session (no sections AND no exercises) — nothing to start.
  if (sections.length === 0 && exercises.length === 0) {
    return 'finished'
  }

  let done = 0
  let total = 0

  for (const section of sections) {
    const trackable = (section.exercises ?? []).filter(
      (ex): ex is typeof ex & { exerciseExternalId: string } =>
        ex.exerciseExternalId != null && ex.exerciseExternalId.length > 0,
    )

    if (trackable.length === 0) {
      // Section has no trackable exercises (e.g. a ForTime "Running" section).
      // Count it as a single unit — complete only if the section itself is marked done.
      total += 1
      if (section.sectionId != null && completedSectionIds.has(section.sectionId)) {
        done += 1
      }
    } else {
      const sectionCompletedIds =
        section.sectionId != null
          ? (completedIdsBySection.get(section.sectionId) ?? new Set<string>())
          : new Set<string>()

      total += trackable.length
      done += trackable.filter((ex) => sectionCompletedIds.has(ex.exerciseExternalId)).length
    }
  }

  // Fallback for sessions that have a flat exercises array but no sections
  // (legacy documents not yet back-filled by WithBackfilledSections).
  if (sections.length === 0 && exercises.length > 0) {
    const trackable = exercises.filter(
      (ex): ex is typeof ex & { exerciseExternalId: string } =>
        ex.exerciseExternalId != null && ex.exerciseExternalId.length > 0,
    )
    // No trackable flat exercises: treat as not-started (live session can bump it).
    if (trackable.length === 0) {
      return hasActiveLiveSession ? 'in-progress' : 'not-started'
    }
    // For the legacy flat path, take the union across all sections (the only
    // map key available is 'default' from the transitional fallback in
    // useCompletionState).
    const flatCompleted = completedIdsBySection.get('default') ?? new Set<string>()
    total = trackable.length
    done = trackable.filter((ex) => flatCompleted.has(ex.exerciseExternalId)).length
  }

  if (done >= total) return 'finished'
  if (done > 0) return 'in-progress'

  // If there's a live session in-flight (sets done but no full exercise ticked),
  // treat the session as in-progress so the CTA says "Continue training".
  if (hasActiveLiveSession) return 'in-progress'

  return 'not-started'
}
