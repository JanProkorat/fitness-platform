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
 *   Eaten state is derived from MealEatenStatusDto[] returned by GET /nutrition/plans/{planId}.
 *   A meal is 'eaten' iff its log entry has isEaten=true.
 *   A day is 'all-eaten' iff every planned mealId in the day resolves to 'eaten'.
 *   Meals/days with no log entry are 'not-touched'.
 */

import type { SessionExecutionDto, LoggedSetDto } from '@/api/training-plan-types';
import type { MealEatenStatusDto } from '@/api/plan-types';

// ── Composite key helper ─────────────────────────────────────────────────────

/**
 * Build the composite key used by the workout-aware maps on `SessionExecutionDto`.
 * Mirrors the backend encoding: `"{workoutId}:{exerciseExternalId}"`.
 */
function compositeKey(workoutId: string, exerciseExternalId: string): string {
  return `${workoutId}:${exerciseExternalId}`;
}

/**
 * Resolve the logged-sets list for a given exercise, preferring the
 * workout-aware map when both a `workoutId` and the new map are present,
 * and falling back to the legacy exercise-only map for historical data.
 *
 * @param sessionExecution  The execution record (may be undefined).
 * @param exerciseExternalId The exercise to look up.
 * @param workoutId  The workout the exercise belongs to. When provided and
 *   `loggedSetsByWorkoutAndExercise` is present on the DTO, the composite
 *   key lookup is used; otherwise falls back to the flat exercise key.
 */
function resolveLoggedSets(
  sessionExecution: SessionExecutionDto,
  exerciseExternalId: string,
  workoutId?: string,
): LoggedSetDto[] | undefined {
  if (
    workoutId &&
    sessionExecution.loggedSetsByWorkoutAndExercise
  ) {
    const key = compositeKey(workoutId, exerciseExternalId);
    const workoutResult = sessionExecution.loggedSetsByWorkoutAndExercise[key];
    // If the key exists in the workout-aware map (even as an empty array),
    // use it. Only fall back to the flat map when the key is entirely absent
    // — this handles the case where the AMRAP workout has no edits but the
    // Standard workout does.
    if (workoutResult !== undefined) return workoutResult;
  }
  return sessionExecution.loggedSetsByExercise[exerciseExternalId];
}

/**
 * Resolve the completed-set-numbers list for a given exercise, preferring the
 * workout-aware map when both a `workoutId` and the new map are present.
 */
function resolveCompletedSets(
  sessionExecution: SessionExecutionDto,
  exerciseExternalId: string,
  workoutId?: string,
): number[] {
  if (
    workoutId &&
    sessionExecution.completedSetsByWorkoutAndExercise
  ) {
    const key = compositeKey(workoutId, exerciseExternalId);
    const workoutResult = sessionExecution.completedSetsByWorkoutAndExercise[key];
    if (workoutResult !== undefined) return workoutResult;
  }
  return sessionExecution.completedSetsByExercise[exerciseExternalId] ?? [];
}

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
 * @param workoutId  The workout the exercise belongs to. Used for workout-aware
 *   map lookup when the backend has emitted `loggedSetsByWorkoutAndExercise`.
 *   Falls back to the legacy flat map when absent or when the composite key
 *   is not present in the workout-aware map.
 */
export function deriveExerciseModificationState(
  sessionExecution: SessionExecutionDto | undefined,
  exerciseExternalId: string,
  workoutId?: string,
): boolean {
  if (!sessionExecution) return false;
  const loggedSets = resolveLoggedSets(sessionExecution, exerciseExternalId, workoutId);
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
 * @param workoutId  The workout the exercise belongs to. When provided and the
 *   backend has emitted `completedSetsByWorkoutAndExercise`, the composite-key
 *   lookup is used; falls back to the legacy flat map for historical data.
 */
export function deriveSetCompletionState(
  sessionExecutions: SessionExecutionDto[] | undefined,
  sessionId: string,
  exerciseExternalId: string,
  setNumber: number,
  workoutId?: string,
): SetCompletionState {
  const execution = sessionExecutions?.find((e) => e.sessionId === sessionId);
  if (!execution) return 'not-reached';

  const completedSets = resolveCompletedSets(execution, exerciseExternalId, workoutId);
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
 * @param workoutId  The workout the exercise belongs to. When provided and the
 *   backend has emitted `completedSetsByWorkoutAndExercise`, the composite-key
 *   lookup is used; falls back to the legacy flat map for historical data.
 */
export function deriveExerciseCompletionState(
  sessionExecutions: SessionExecutionDto[] | undefined,
  sessionId: string,
  exerciseExternalId: string,
  totalSets: number,
  workoutId?: string,
): { state: ExerciseCompletionState; counts: ExerciseCounts } {
  const counts: ExerciseCounts = { completed: 0, skipped: 0, total: totalSets };

  if (totalSets === 0) return { state: 'none', counts };

  const execution = sessionExecutions?.find((e) => e.sessionId === sessionId);
  if (!execution) return { state: 'none', counts };

  const completedSets = resolveCompletedSets(execution, exerciseExternalId, workoutId);
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
 * @param exercises          All exercises in the session (for total set counts).
 *   Each entry may include an optional `workoutId` for workout-aware lookup.
 *   When `workoutId` is provided and `completedSetsByWorkoutAndExercise` is
 *   present on the execution DTO, the composite key is used; otherwise falls
 *   back to the legacy flat map.
 */
export function deriveSessionCompletionState(
  sessionExecutions: SessionExecutionDto[] | undefined,
  sessionId: string,
  exercises: Array<{ exerciseExternalId: string; sets: unknown[]; workoutId?: string }>,
): { state: SessionCompletionState; counts: SessionCounts } {
  const counts: SessionCounts = { completed: 0, skipped: 0, total: 0 };

  for (const ex of exercises) {
    counts.total += ex.sets.length;
  }

  if (counts.total === 0) return { state: 'none', counts };

  const execution = sessionExecutions?.find((e) => e.sessionId === sessionId);
  if (!execution) return { state: 'none', counts };

  for (const ex of exercises) {
    const completedSets = resolveCompletedSets(execution, ex.exerciseExternalId, ex.workoutId);
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
 * A meal is 'eaten' iff at least one MealEatenStatusDto exists for the given mealId
 * with isEaten === true. The logDate is not used for matching — any log entry
 * with isEaten for this mealId counts. Photo-only stubs (isEaten=false) are
 * treated the same as no log entry.
 *
 * @param mealLogs  Full list from NutritionPlanDetail.mealLogs (may be empty)
 * @param mealId    The PlanMeal.mealId to check
 */
export function deriveMealCompletionState(
  mealLogs: MealEatenStatusDto[] | undefined,
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
  mealLogs: MealEatenStatusDto[] | undefined,
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
