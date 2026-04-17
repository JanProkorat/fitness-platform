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
} from './generated';

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
