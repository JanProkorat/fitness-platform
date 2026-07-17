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
import type { LoggedSetDto } from '@/api/wod-types'

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

// ─── deriveExerciseHasModifications ─────────────────────────────────────────

/**
 * Derives whether a specific exercise has any modified sets, given the
 * per-exercise logged-sets map from GetTodaySession.
 *
 * The plan/today endpoint does NOT expose a per-exercise hasModifications field
 * (it only has hasModificationsBySession at session level).  This helper derives
 * the per-exercise flag from the per-set isModified flags in
 * loggedSetsBySessionExercise so the Today card can show the "upraveno" badge on
 * individual exercise headers (#441 design handoff finding #3).
 *
 * @param exerciseExternalId   The exercise's external id.
 * @param loggedSetsForSession The inner map for this session:
 *                             exerciseExternalId → LoggedSetDto[].
 *                             May be undefined if no log exists yet.
 * @returns true when any set under this exercise has isModified === true.
 */
export function deriveExerciseHasModifications(
  exerciseExternalId: string,
  loggedSetsForSession: Readonly<Record<string, LoggedSetDto[]>> | undefined,
): boolean {
  if (!loggedSetsForSession) return false
  const sets = loggedSetsForSession[exerciseExternalId]
  if (!sets || sets.length === 0) return false
  return sets.some((s) => s.isModified)
}

// ─── computeLockedSessionIds ──────────────────────────────────────────────────

/**
 * Returns a set of sessionIds that should show a locked CTA because another
 * session in the same day is currently live (active).
 *
 * - If `hasActiveSession` is false or `activeSessionId` is null, returns an
 *   empty set (nothing to lock).
 * - Otherwise returns the sessionIds of all sessions whose `sessionId` is
 *   non-null AND is not the currently active session.
 *
 * This is a pure helper — no React, no store imports. It mirrors the same
 * style as `deriveSessionCtaState` so it can be unit-tested without React Native.
 *
 * @param sessions         Today's training sessions.
 * @param hasActiveSession Whether a live session is currently in-flight.
 * @param activeSessionId  The sessionId of the live session (from liveSessionStore).
 */
export function computeLockedSessionIds(
  sessions: readonly TrainingSession[],
  hasActiveSession: boolean,
  activeSessionId: string | null,
): ReadonlySet<string> {
  if (!hasActiveSession || activeSessionId == null) {
    return new Set<string>()
  }
  const locked = new Set<string>()
  for (const session of sessions) {
    if (session.sessionId != null && session.sessionId !== activeSessionId) {
      locked.add(session.sessionId)
    }
  }
  return locked
}
