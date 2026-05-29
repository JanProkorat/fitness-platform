/**
 * Completion-state derivation helpers for training plan set/exercise/session display.
 *
 * The backend never stores completion state flags — it surfaces the raw execution
 * data (CompletedSetsByExercise + IsSessionFinished) from WorkoutLog documents.
 * This module derives the visual states from those primitives.
 *
 * Disambiguation rules (per backend SessionExecutionDto docstring):
 *   completed      → set's 1-based index is in completedSetsByExercise[exerciseId]
 *   skipped        → isSessionFinished=true AND index NOT in the list
 *   not-yet-reached → isSessionFinished=false (or no execution row for the session)
 */

import type { SessionExecutionDto } from '@/api/training-plan-types';

// ── Per-set state ────────────────────────────────────────────────────────────

export type SetCompletionState = 'completed' | 'skipped' | 'not-reached';

/**
 * Derive the completion state for a single set.
 *
 * @param sessionExecutions  Full list from TrainingPlanDetail.sessionExecutions (may be absent)
 * @param sessionId          The session this set belongs to
 * @param exerciseExternalId The exercise this set belongs to
 * @param setNumber          1-based set number (matches ExerciseSet.setNumber)
 */
export function deriveSetCompletionState(
  sessionExecutions: SessionExecutionDto[] | undefined,
  sessionId: string,
  exerciseExternalId: string,
  setNumber: number,
): SetCompletionState {
  const execution = sessionExecutions?.find((e) => e.sessionId === sessionId);
  if (!execution) return 'not-reached';

  const completedSets = execution.completedSetsByExercise[exerciseExternalId] ?? [];
  if (completedSets.includes(setNumber)) return 'completed';

  return execution.isSessionFinished ? 'skipped' : 'not-reached';
}

// ── Per-exercise aggregate ───────────────────────────────────────────────────

export type ExerciseCompletionState =
  | 'fully-complete'   // all sets completed, none skipped
  | 'mixed'            // some completed AND some skipped (session finished)
  | 'partial-no-skips' // some completed, session still in progress (not-reached = in-progress)
  | 'none';            // nothing completed or session has no execution row

export interface ExerciseCounts {
  completed: number;
  skipped: number;
  total: number;
}

/**
 * Derive aggregate completion state for an exercise.
 *
 * @param sessionExecutions  Full list from TrainingPlanDetail.sessionExecutions
 * @param sessionId          The session this exercise belongs to
 * @param exerciseExternalId The exercise
 * @param totalSets          Total number of planned sets (ExerciseSet[].length)
 */
export function deriveExerciseCompletionState(
  sessionExecutions: SessionExecutionDto[] | undefined,
  sessionId: string,
  exerciseExternalId: string,
  totalSets: number,
): { state: ExerciseCompletionState; counts: ExerciseCounts } {
  const counts: ExerciseCounts = { completed: 0, skipped: 0, total: totalSets };

  if (totalSets === 0) return { state: 'none', counts };

  const execution = sessionExecutions?.find((e) => e.sessionId === sessionId);
  if (!execution) return { state: 'none', counts };

  const completedSets = execution.completedSetsByExercise[exerciseExternalId] ?? [];
  counts.completed = completedSets.length;

  if (execution.isSessionFinished) {
    counts.skipped = totalSets - counts.completed;
  }

  if (counts.completed === 0) return { state: 'none', counts };
  if (counts.completed === totalSets) return { state: 'fully-complete', counts };
  if (counts.skipped > 0) return { state: 'mixed', counts };
  return { state: 'partial-no-skips', counts };
}

// ── Per-session aggregate ────────────────────────────────────────────────────

export type SessionCompletionState =
  | 'all-complete' // every planned set in the session was completed
  | 'mixed'        // session finished but some sets were skipped
  | 'in-progress'  // some sets completed, session not yet finalised
  | 'none';        // no execution data or nothing completed

export interface SessionCounts {
  completed: number;
  skipped: number;
  total: number;
}

/**
 * Derive aggregate completion state for an entire session.
 *
 * @param sessionExecutions  Full list from TrainingPlanDetail.sessionExecutions
 * @param sessionId          The session
 * @param exercises          All exercises in the session (for total set counts)
 */
export function deriveSessionCompletionState(
  sessionExecutions: SessionExecutionDto[] | undefined,
  sessionId: string,
  exercises: Array<{ exerciseExternalId: string; sets: unknown[] }>,
): { state: SessionCompletionState; counts: SessionCounts } {
  const counts: SessionCounts = { completed: 0, skipped: 0, total: 0 };

  for (const ex of exercises) {
    counts.total += ex.sets.length;
  }

  if (counts.total === 0) return { state: 'none', counts };

  const execution = sessionExecutions?.find((e) => e.sessionId === sessionId);
  if (!execution) return { state: 'none', counts };

  for (const ex of exercises) {
    const completedSets = execution.completedSetsByExercise[ex.exerciseExternalId] ?? [];
    counts.completed += completedSets.length;
  }

  if (counts.completed === 0) return { state: 'none', counts };

  if (execution.isSessionFinished) {
    counts.skipped = counts.total - counts.completed;
    if (counts.skipped === 0) return { state: 'all-complete', counts };
    return { state: 'mixed', counts };
  }

  return { state: 'in-progress', counts };
}
