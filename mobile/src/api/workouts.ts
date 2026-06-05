import api from './client';
import type {
  WorkoutSet,
  WorkoutExercise,
  WorkoutLogDetail,
  WorkoutLogSummary,
  GetWorkoutLogsResponse,
  StartWorkoutResponse,
  UpdateWorkoutExerciseRequest,
  UpdateWorkoutRequest,
  GetExerciseProgressResponse,
  ExerciseProgressPoint,
  GoLiveResponse,
  AbandonWorkoutResponse,
} from './generated';
import type { UpdateWorkoutSetWithPlannedRequest } from './wod-types';

// Re-export generated types so consumer imports (`from '@/api/workouts'`) still work.
export type {
  WorkoutSet,
  WorkoutExercise,
  WorkoutLogDetail,
  WorkoutLogSummary,
  GetWorkoutLogsResponse,
  StartWorkoutResponse,
  UpdateWorkoutExerciseRequest,
  UpdateWorkoutRequest,
  ExerciseProgressPoint,
  GoLiveResponse,
  AbandonWorkoutResponse,
  UpdateWorkoutSetWithPlannedRequest,
};

/**
 * @deprecated Use `GetExerciseProgressResponse` from generated. Kept as alias for backward compatibility.
 */
export type ExerciseProgressResponse = GetExerciseProgressResponse;

// --- API calls ---

export async function startWorkout(params?: {
  planId?: string;
  sessionId?: string;
}): Promise<StartWorkoutResponse> {
  const { data } = await api.post<StartWorkoutResponse>('/client/training/logs', params ?? {});
  return data;
}

export async function updateWorkout(
  logId: string,
  request: UpdateWorkoutRequest,
): Promise<WorkoutLogDetail> {
  const { data } = await api.put<WorkoutLogDetail>(`/client/training/logs/${logId}`, request);
  return data;
}

export async function completeWorkout(logId: string): Promise<WorkoutLogDetail> {
  const { data } = await api.post<WorkoutLogDetail>(`/client/training/logs/${logId}/complete`);
  return data;
}

/**
 * Acquires the Live lock for an existing draft log.
 * Call this when the user taps "Start" — NOT on mount (draft creation).
 * Returns 409 with errorCode "session_locked" if another editor holds the lock.
 */
export async function goLive(logId: string): Promise<GoLiveResponse> {
  const { data } = await api.post<GoLiveResponse>(`/client/training/logs/${logId}/go-live`);
  return data;
}

/**
 * Releases the Live lock for a log. Idempotent: succeeds (200) even when
 * no lock is currently held (e.g. it already expired or was never acquired).
 * Call on discard or when leaving an in-progress session without completing.
 */
export async function abandonWorkout(logId: string): Promise<AbandonWorkoutResponse> {
  const { data } = await api.post<AbandonWorkoutResponse>(`/client/training/logs/${logId}/abandon`);
  return data;
}

export async function getWorkoutLogs(params?: {
  page?: number;
  pageSize?: number;
}): Promise<GetWorkoutLogsResponse> {
  const { data } = await api.get<GetWorkoutLogsResponse>('/client/training/logs', { params });
  return data;
}

export async function getWorkoutLog(logId: string): Promise<WorkoutLogDetail> {
  const { data } = await api.get<WorkoutLogDetail>(`/client/training/logs/${logId}`);
  return data;
}

export async function getExerciseProgress(
  clientId: string,
  exerciseId: string,
): Promise<GetExerciseProgressResponse> {
  const { data } = await api.get<GetExerciseProgressResponse>(
    `/training/clients/${clientId}/progress/${exerciseId}`,
  );
  return data;
}
