import api from '@/lib/api';
import type {
  SearchExercisesResponse,
  ExerciseDetail,
  ExerciseSummary,
  CreateExerciseRequest,
  UpdateExerciseRequest,
  UploadUrlResponse,
  MuscleGroup,
  ExerciseEquipment,
  ExerciseCategory,
  ExerciseDifficulty,
} from './exercise-types';

/** Search exercises with optional filters. */
export async function searchExercises(params: {
  q?: string;
  muscleGroup?: MuscleGroup;
  equipment?: ExerciseEquipment;
  category?: ExerciseCategory;
  difficulty?: ExerciseDifficulty;
  page?: number;
  pageSize?: number;
}): Promise<SearchExercisesResponse> {
  const { data } = await api.get<SearchExercisesResponse>('/exercises/search', { params });
  return data;
}

/** Get a single exercise by ID. */
export async function getExercise(exerciseId: string): Promise<ExerciseDetail> {
  const { data } = await api.get<ExerciseDetail>(`/exercises/${exerciseId}`);
  return data;
}

/** Create a custom exercise (Trainer only). */
export async function createExercise(request: CreateExerciseRequest): Promise<ExerciseSummary> {
  const { data } = await api.post<ExerciseSummary>('/exercises', request);
  return data;
}

/** Update a custom exercise (Trainer only). */
export async function updateExercise(exerciseId: string, request: UpdateExerciseRequest): Promise<ExerciseSummary> {
  const { data } = await api.put<ExerciseSummary>(`/exercises/${exerciseId}`, request);
  return data;
}

/** Delete a custom exercise (soft delete, Trainer only). */
export async function deleteExercise(exerciseId: string): Promise<void> {
  await api.delete(`/exercises/${exerciseId}`);
}

/** Generate a pre-signed upload URL for exercise video. */
export async function generateUploadUrl(exerciseId: string, contentType = 'video/mp4'): Promise<UploadUrlResponse> {
  const { data } = await api.post<UploadUrlResponse>(`/exercises/${exerciseId}/upload-url`, { contentType });
  return data;
}

/** Get custom exercises for the authenticated trainer. */
export async function getCustomExercises(params: {
  page?: number;
  pageSize?: number;
}): Promise<SearchExercisesResponse> {
  const { data } = await api.get<SearchExercisesResponse>('/exercises/custom', { params });
  return data;
}
