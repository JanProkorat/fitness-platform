import api from './client';
import type {
  MarkExerciseCompleteRequest,
  MarkExerciseCompleteResponse,
  MarkExerciseIncompleteRequest,
  MarkExerciseIncompleteResponse,
  MarkSectionCompleteRequest,
  MarkSectionCompleteResponse,
  MarkSectionIncompleteRequest,
  MarkSectionIncompleteResponse,
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
  MarkSectionCompleteRequest,
  MarkSectionCompleteResponse,
  MarkSectionIncompleteRequest,
  MarkSectionIncompleteResponse,
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
 * Mark a single exercise within a session as complete.
 * `sectionId` is required to identify which section instance of a catalog
 * exercise is being marked, preventing cross-section completion bleed.
 * Idempotent — re-completing an already-complete exercise returns success.
 */
export async function markExerciseComplete(
  sessionId: string,
  exerciseExternalId: string,
  request: MarkExerciseCompleteRequest,
): Promise<MarkExerciseCompleteResponse> {
  const { data } = await api.post<MarkExerciseCompleteResponse>(
    `/client/training/sessions/${sessionId}/exercises/${exerciseExternalId}/complete`,
    request,
  );
  return data;
}

/**
 * Remove the completion mark for a single exercise within a session.
 * `sectionId` is required to identify which section instance is being
 * un-marked, leaving other sections' completion state for the same catalog
 * exercise untouched.
 * Idempotent — if the exercise is already not marked complete, returns success.
 */
export async function markExerciseIncomplete(
  sessionId: string,
  exerciseExternalId: string,
  request: MarkExerciseIncompleteRequest,
): Promise<MarkExerciseIncompleteResponse> {
  const { data } = await api.delete<MarkExerciseIncompleteResponse>(
    `/client/training/sessions/${sessionId}/exercises/${exerciseExternalId}/complete`,
    { data: request },
  );
  return data;
}

/**
 * Mark a single section (workout) within a session as complete.
 * Used for sections that don't track at the exercise level — typically
 * ForTime workouts that are just a name + time cap (e.g. "Running").
 * Idempotent.
 */
export async function markSectionComplete(
  sessionId: string,
  sectionId: string,
  request: MarkSectionCompleteRequest = {},
): Promise<MarkSectionCompleteResponse> {
  const { data } = await api.post<MarkSectionCompleteResponse>(
    `/client/training/sessions/${sessionId}/sections/${sectionId}/complete`,
    request,
  );
  return data;
}

/**
 * Remove the completion mark for a single section within a session.
 * Idempotent.
 */
export async function markSectionIncomplete(
  sessionId: string,
  sectionId: string,
  request: MarkSectionIncompleteRequest = {},
): Promise<MarkSectionIncompleteResponse> {
  const { data } = await api.delete<MarkSectionIncompleteResponse>(
    `/client/training/sessions/${sessionId}/sections/${sectionId}/complete`,
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
