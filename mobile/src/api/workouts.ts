import api from './client';

// --- Types ---

export interface WorkoutSet {
  setNumber: number;
  reps?: number | null;
  weightKg?: number | null;
  rpe?: number | null;
  durationSeconds?: number | null;
  distanceMeters?: number | null;
  completedAt?: string | null;
  isPR: boolean;
}

export interface WorkoutExercise {
  exerciseExternalId: string;
  exerciseName: string;
  sets: WorkoutSet[];
}

export interface WorkoutLogDetail {
  logId: string;
  clientId: string;
  planId?: string | null;
  sessionId?: string | null;
  startedAt: string;
  completedAt?: string | null;
  durationSeconds?: number | null;
  mood?: number | null;
  notes?: string | null;
  isCompleted: boolean;
  exercises: WorkoutExercise[];
  hasPR: boolean;
}

export interface WorkoutLogSummary {
  logId: string;
  startedAt: string;
  completedAt?: string | null;
  durationSeconds?: number | null;
  mood?: number | null;
  isCompleted: boolean;
  exerciseCount: number;
  setCount: number;
  hasPR: boolean;
}

export interface GetWorkoutLogsResponse {
  logs: WorkoutLogSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface StartWorkoutResponse {
  logId: string;
  startedAt: string;
}

export interface UpdateWorkoutExerciseRequest {
  exerciseExternalId: string;
  exerciseName: string;
  sets: {
    setNumber: number;
    reps?: number | null;
    weightKg?: number | null;
    rpe?: number | null;
    durationSeconds?: number | null;
    distanceMeters?: number | null;
    completedAt?: string | null;
  }[];
}

export interface UpdateWorkoutRequest {
  mood?: number | null;
  notes?: string | null;
  exercises: UpdateWorkoutExerciseRequest[];
}

export interface ExerciseProgressPoint {
  date: string;
  bestWeightKg?: number | null;
  bestReps?: number | null;
  totalVolume: number;
  hasPR: boolean;
}

export interface ExerciseProgressResponse {
  exerciseName: string;
  dataPoints: ExerciseProgressPoint[];
}

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
): Promise<ExerciseProgressResponse> {
  const { data } = await api.get<ExerciseProgressResponse>(
    `/training/clients/${clientId}/progress/${exerciseId}`,
  );
  return data;
}
