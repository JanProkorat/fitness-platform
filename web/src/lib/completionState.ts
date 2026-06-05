/**
 * Completion-state derivation helpers for training plan set/exercise/session display,
 * and nutrition plan meal/day eaten-state display.
 *
 * Training plan:
 *   The backend never stores completion state flags — it surfaces the raw execution
 *   data (CompletedSetsByExercise + IsSessionFinished) from WorkoutLog documents.
 *   This module derives the visual states from those primitives.
 *
 *   Disambiguation rules (per backend SessionExecutionDto docstring):
 *     completed      → set's 1-based index is in completedSetsByExercise[exerciseId]
 *     skipped        → isSessionFinished=true AND index NOT in the list
 *     not-yet-reached → isSessionFinished=false (or no execution row for the session)
 *
 * Nutrition plan:
 *   Eaten state is derived from MealLogDto[] returned by GET /nutrition/plans/{planId}.
 *   A meal is 'eaten' iff its log entry has isEaten=true.
 *   A day is 'all-eaten' iff every planned mealId in the day resolves to 'eaten'.
 *   Meals/days with no log entry are 'not-touched'.
 */

import type { SessionExecutionDto } from '@/api/training-plan-types';
import type { MealLogDto } from '@/api/plan-types';

// ── Per-exercise modification state ─────────────────────────────────────────

/**
 * Derive whether an exercise has any set-level modifications.
 *
 * The backend only surfaces session-level hasModifications and per-set isModified
 * flags. There is no per-exercise hasModifications on the DTO — we derive it
 * client-side by checking whether any LoggedSetDto under the exercise has
 * isModified === true.
 *
 * @param sessionExecution  The execution record for the session (may be undefined)
 * @param exerciseExternalId The exercise to check
 */
export function deriveExerciseModificationState(
  sessionExecution: SessionExecutionDto | undefined,
  exerciseExternalId: string,
): boolean {
  if (!sessionExecution) return false;
  const loggedSets = sessionExecution.loggedSetsByExercise[exerciseExternalId];
  if (!loggedSets || loggedSets.length === 0) return false;
  return loggedSets.some((s) => s.isModified);
}

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

// ── Nutrition plan: per-meal eaten state ─────────────────────────────────────

export type MealCompletionState = 'eaten' | 'not-touched';

/**
 * Derive the eaten state for a single planned meal.
 *
 * A meal is 'eaten' iff at least one MealLogDto exists for the given mealId
 * with isEaten === true. The logDate is not used for matching — any log entry
 * with isEaten for this mealId counts. Photo-only stubs (isEaten=false) are
 * treated the same as no log entry.
 *
 * @param mealLogs  Full list from NutritionPlanDetail.mealLogs (may be empty)
 * @param mealId    The PlanMeal.mealId to check
 */
export function deriveMealCompletionState(
  mealLogs: MealLogDto[] | undefined,
  mealId: string,
): MealCompletionState {
  if (!mealLogs || mealLogs.length === 0) return 'not-touched';
  const hasEaten = mealLogs.some((log) => log.mealId === mealId && log.isEaten);
  return hasEaten ? 'eaten' : 'not-touched';
}

// ── Nutrition plan: per-day eaten state ─────────────────────────────────────

export type DayCompletionState = 'all-eaten' | 'not-touched';

export interface DayCompletionCounts {
  eaten: number;
  total: number;
}

/**
 * Derive the day-level eaten state from the list of meal ids in a day.
 *
 * 'all-eaten' iff every mealId in mealIdsInDay resolves to 'eaten'.
 * Returns 'not-touched' if the day has no meals or none are eaten.
 *
 * @param mealLogs      Full list from NutritionPlanDetail.mealLogs
 * @param mealIdsInDay  All PlanMeal.mealId values present in the day
 */
export function deriveDayCompletionState(
  mealLogs: MealLogDto[] | undefined,
  mealIdsInDay: string[],
): { state: DayCompletionState; counts: DayCompletionCounts } {
  const total = mealIdsInDay.length;
  if (total === 0) {
    return { state: 'not-touched', counts: { eaten: 0, total: 0 } };
  }

  let eaten = 0;
  for (const mealId of mealIdsInDay) {
    if (deriveMealCompletionState(mealLogs, mealId) === 'eaten') {
      eaten++;
    }
  }

  const state: DayCompletionState = eaten === total ? 'all-eaten' : 'not-touched';
  return { state, counts: { eaten, total } };
}
