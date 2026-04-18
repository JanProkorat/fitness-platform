import api from './client';

// ─── Request types ──────────────────────────────────────────────────────────
// These mirror the backend request models; defined locally because the current
// generated.ts snapshot pre-dates PR #23. When the API client is regenerated
// (once the backend is reachable), these can be re-exported from generated.ts
// and the local declarations removed.

export interface MarkExerciseCompleteRequest {
  /** ISO date string (date only, UTC). Defaults to today UTC when omitted. */
  completedOn?: string;
  /** Optimistic concurrency version. Required when a completion doc already exists. */
  version?: number;
}

export interface MarkExerciseIncompleteRequest {
  /** ISO date string (date only, UTC). Defaults to today UTC when omitted. */
  completedOn?: string;
  /** Optimistic concurrency version. */
  version?: number;
}

export interface MarkSessionCompleteRequest {
  /** ISO date string (date only, UTC). Defaults to today UTC when omitted. */
  completedOn?: string;
  /** Optimistic concurrency version. */
  version?: number;
}

export interface MarkSessionIncompleteRequest {
  /** ISO date string (date only, UTC). Defaults to today UTC when omitted. */
  completedOn?: string;
  /** Optimistic concurrency version. */
  version?: number;
}

export interface MarkWholeDayCompleteRequest {
  /** ISO date string (date only, UTC). Defaults to today UTC when omitted. */
  date?: string;
}

// ─── Response types ──────────────────────────────────────────────────────────

/** Returned by mark-exercise-complete and mark-exercise-incomplete. */
export interface MarkExerciseCompleteResponse {
  /** The session that was updated. */
  sessionId: string;
  /** The date for which the completion was recorded (ISO date only). */
  date: string;
  /** How many exercises in this session are now marked complete. */
  completedExerciseCount: number;
  /** Total number of exercises in this session. */
  totalExerciseCount: number;
  /** Whether every exercise in this session is now complete. */
  sessionComplete: boolean;
  /** Current document version for subsequent writes. */
  version: number;
}

/** Returned by mark-session-complete and mark-session-incomplete. */
export interface MarkSessionCompleteResponse {
  /** The session that was marked complete. */
  sessionId: string;
  /** The date for which the session was marked complete (ISO date only). */
  date: string;
  /** Number of exercises now marked complete. */
  completedExerciseCount: number;
  /** Total exercises in the session. */
  totalExerciseCount: number;
  /** Current document version. */
  version: number;
}

/** Per-session summary inside MarkWholeDayCompleteResponse. */
export interface SessionCompletionSummary {
  sessionId: string;
  completedExerciseCount: number;
  totalExerciseCount: number;
  version: number;
}

/** Returned by mark-whole-day-complete. */
export interface MarkWholeDayCompleteResponse {
  /** The date that was marked complete (ISO date only). */
  date: string;
  /** Summary per session that was processed. */
  sessions: SessionCompletionSummary[];
}

// ─── API calls ───────────────────────────────────────────────────────────────

/**
 * Mark a single exercise within a session as complete.
 * Idempotent — re-completing an already-complete exercise returns success.
 */
export async function markExerciseComplete(
  sessionId: string,
  exerciseExternalId: string,
  request: MarkExerciseCompleteRequest = {},
): Promise<MarkExerciseCompleteResponse> {
  const { data } = await api.post<MarkExerciseCompleteResponse>(
    `/client/training/sessions/${sessionId}/exercises/${exerciseExternalId}/complete`,
    request,
  );
  return data;
}

/**
 * Remove the completion mark for a single exercise within a session.
 * Idempotent — if the exercise is already not marked complete, returns success.
 */
export async function markExerciseIncomplete(
  sessionId: string,
  exerciseExternalId: string,
  request: MarkExerciseIncompleteRequest = {},
): Promise<MarkExerciseCompleteResponse> {
  const { data } = await api.delete<MarkExerciseCompleteResponse>(
    `/client/training/sessions/${sessionId}/exercises/${exerciseExternalId}/complete`,
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
): Promise<MarkSessionCompleteResponse> {
  const { data } = await api.delete<MarkSessionCompleteResponse>(
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
