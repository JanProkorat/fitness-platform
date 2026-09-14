import api from './client';
import type {
  MarkExerciseCompleteRequest,
  MarkExerciseCompleteResponse,
  MarkExerciseIncompleteRequest,
  MarkExerciseIncompleteResponse,
  MarkWorkoutCompleteRequest,
  MarkWorkoutCompleteResponse,
  MarkWorkoutIncompleteRequest,
  MarkWorkoutIncompleteResponse,
  MarkSessionCompleteRequest,
  MarkSessionCompleteResponse,
  MarkSessionIncompleteRequest,
  MarkSessionIncompleteResponse,
  MarkWholeDayCompleteRequest,
  MarkWholeDayCompleteResponse,
  SessionCompletionSummary,
} from './generated';
import type { WodResult } from './wod-types';

// Re-export generated request/response types so consumer imports
// (`from '@/api/trainingCompletion'`) continue to work unchanged.
export type {
  MarkExerciseCompleteRequest,
  MarkExerciseCompleteResponse,
  MarkExerciseIncompleteRequest,
  MarkExerciseIncompleteResponse,
  MarkWorkoutCompleteRequest,
  MarkWorkoutCompleteResponse,
  MarkWorkoutIncompleteRequest,
  MarkWorkoutIncompleteResponse,
  MarkSessionCompleteRequest,
  MarkSessionCompleteResponse,
  MarkSessionIncompleteRequest,
  MarkSessionIncompleteResponse,
  MarkWholeDayCompleteRequest,
  MarkWholeDayCompleteResponse,
  SessionCompletionSummary,
};

// Re-export WodResult so callers can type-narrow their completion payloads.
export type { WodResult };

// ─── API calls ───────────────────────────────────────────────────────────────

/**
 * Mark a single exercise instance within a session as complete.
 * `exerciseId` is the per-instance id (SessionExercise.exerciseId), NOT the
 * catalog exerciseExternalId — the backend resolves the route segment
 * against the session's instance ids, so it distinguishes two placements of
 * the same catalog exercise in one session (nested + standalone, or nested
 * twice).
 * Idempotent — re-completing an already-complete exercise returns success.
 */
export async function markExerciseComplete(
  sessionId: string,
  exerciseId: string,
  request: MarkExerciseCompleteRequest,
): Promise<MarkExerciseCompleteResponse> {
  const { data } = await api.post<MarkExerciseCompleteResponse>(
    `/client/training/sessions/${sessionId}/exercises/${exerciseId}/complete`,
    request,
  );
  return data;
}

/**
 * Remove the completion mark for a single exercise instance within a session.
 * `exerciseId` is the per-instance id, leaving other placements of the same
 * catalog exercise in the same session untouched.
 * Idempotent — if the exercise is already not marked complete, returns success.
 */
export async function markExerciseIncomplete(
  sessionId: string,
  exerciseId: string,
  request: MarkExerciseIncompleteRequest,
): Promise<MarkExerciseIncompleteResponse> {
  const { data } = await api.delete<MarkExerciseIncompleteResponse>(
    `/client/training/sessions/${sessionId}/exercises/${exerciseId}/complete`,
    { data: request },
  );
  return data;
}

/**
 * Mark a single workout within a session as complete.
 * Used for workouts that don't track at the exercise level — typically
 * ForTime workouts that are just a name + time cap (e.g. "Running").
 * Idempotent.
 */
export async function markWorkoutComplete(
  sessionId: string,
  workoutId: string,
  request: MarkWorkoutCompleteRequest = {},
): Promise<MarkWorkoutCompleteResponse> {
  const { data } = await api.post<MarkWorkoutCompleteResponse>(
    `/client/training/sessions/${sessionId}/workouts/${workoutId}/complete`,
    request,
  );
  return data;
}

/**
 * Remove the completion mark for a single workout within a session.
 * Idempotent.
 */
export async function markWorkoutIncomplete(
  sessionId: string,
  workoutId: string,
  request: MarkWorkoutIncompleteRequest = {},
): Promise<MarkWorkoutIncompleteResponse> {
  const { data } = await api.delete<MarkWorkoutIncompleteResponse>(
    `/client/training/sessions/${sessionId}/workouts/${workoutId}/complete`,
    { data: request },
  );
  return data;
}

/**
 * Mark an entire training session as complete (fans out to all exercises).
 * Idempotent.
 */
export async function markSessionComplete(
  sessionId: string,
  request: MarkSessionCompleteRequest = {},
): Promise<MarkSessionCompleteResponse> {
  const { data } = await api.post<MarkSessionCompleteResponse>(
    `/client/training/sessions/${sessionId}/complete`,
    request,
  );
  return data;
}

/**
 * Remove the completion mark for an entire training session.
 * Idempotent.
 */
export async function markSessionIncomplete(
  sessionId: string,
  request: MarkSessionIncompleteRequest = {},
): Promise<MarkSessionIncompleteResponse> {
  const { data } = await api.delete<MarkSessionIncompleteResponse>(
    `/client/training/sessions/${sessionId}/complete`,
    { data: request },
  );
  return data;
}

/**
 * Mark every training session scheduled for a calendar day complete.
 * Resolves sessions from the active plan's week/day-of-week mapping.
 * Idempotent — already-complete sessions are skipped.
 */
export async function markWholeDayComplete(
  request: MarkWholeDayCompleteRequest = {},
): Promise<MarkWholeDayCompleteResponse> {
  const { data } = await api.post<MarkWholeDayCompleteResponse>(
    '/client/training/day/complete',
    request,
  );
  return data;
}
