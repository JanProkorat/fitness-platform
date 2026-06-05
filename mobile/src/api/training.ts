import api from './client';
import {
  SetType,
  MuscleGroup,
  WorkoutFormat,
  MovementType,
} from './generated';
import type {
  ExerciseSet,
  SessionExercise,
  TrainingSection as GeneratedTrainingSection,
  TrainingSession,
  GetTodaySessionResponse,
  GetFullTrainingPlanResponse,
  WeekDto,
  SessionDto,
  SectionDto,
  ExerciseDto,
  SetDto,
  WodConfig,
  SessionPhotoDto,
  GenerateSessionPhotoUploadUrlResponse,
} from './generated';

// Re-export generated types and enums so consumer imports (`from '@/api/training'`) still work.
export { SetType, MuscleGroup, WorkoutFormat, MovementType };
export type {
  ExerciseSet,
  SessionExercise,
  TrainingSession,
  GetTodaySessionResponse,
  GetFullTrainingPlanResponse,
  WeekDto,
  SessionDto,
  SectionDto,
  ExerciseDto,
  SetDto,
  WodConfig,
  SessionPhotoDto,
  GenerateSessionPhotoUploadUrlResponse,
};

/**
 * Augmented TrainingSection — widens the generated `notes` field to accept
 * `null` (the backend serialises null when no note is set; NSwag emits
 * `string | undefined` which rejects null at compile time).
 * Uses Omit to re-declare `notes` rather than `extends` so TypeScript does
 * not reject the `null` widening with TS2430.
 */
export type TrainingSection = Omit<GeneratedTrainingSection, 'notes'> & {
  /** Optional coach notes for this workout/section. */
  notes?: string | null;
}

// Re-export WOD types from wod-types (UpdateWodExerciseRequest and UpdateWorkoutWodRequest
// are still hand-maintained; WodResult, WodConfig, LoggedSetDto are re-exported
// from generated via wod-types).
export type {
  WodResult,
  WodSessionExercise,
  LoggedSetDto,
  UpdateWodExerciseRequest,
  UpdateWorkoutWodRequest,
} from './wod-types';

/**
 * `TodayTrainingResponse` is now a direct alias for `GetTodaySessionResponse`.
 * After the #440 regen all previously-augmented fields
 * (`lockStateBySession`, `photosBySession`, `notesBySession`,
 * `loggedSetsBySessionExercise`, `hasModificationsBySession`)
 * are emitted natively by generated.ts.
 */
export type TodayTrainingResponse = GetTodaySessionResponse;

/**
 * @deprecated Use `GetFullTrainingPlanResponse` from generated. Kept as alias for backward compatibility.
 */
export type FullTrainingPlanResponse = GetFullTrainingPlanResponse;

/**
 * @deprecated Use `WeekDto` from generated. Kept as alias for backward compatibility.
 */
export type FullPlanWeek = WeekDto;

/**
 * @deprecated Use `SessionDto` from generated. Kept as alias for backward compatibility.
 */
export type FullPlanSession = SessionDto;

/**
 * `FullPlanExercise` is now a direct alias for the generated `ExerciseDto`.
 * After the #440 regen `ExerciseDto` carries `hasModifications` and
 * `sets?: SetDto[]` (where `SetDto` has all actual + planned + isModified fields).
 * Kept as alias for backward compatibility with `SetGrid` and `LiveFinishedSummary`.
 */
export type FullPlanExercise = ExerciseDto;

/**
 * `FullPlanSet` is now a direct alias for the generated `SetDto`.
 * After the #440 regen `SetDto` carries all actual values, snapshot-planned
 * values, and the backend-computed `isModified` flag.
 * Kept as alias for backward compatibility with `SetGrid` and `LiveFinishedSummary`.
 */
export type FullPlanSet = SetDto;

// --- API calls ---

export async function getTodaySession(): Promise<GetTodaySessionResponse> {
  const { data } = await api.get<GetTodaySessionResponse>('/client/training/plan/today');
  return data;
}

export async function getFullTrainingPlan(planId: string): Promise<GetFullTrainingPlanResponse> {
  const { data } = await api.get<GetFullTrainingPlanResponse>(`/client/training/plans/${planId}`);
  return data;
}

// ─── Session photo upload API (#405) ─────────────────────────────────────────
// Mirrors the nutrition meal-photo API pattern exactly.
// GenerateSessionPhotoUploadUrlResponse and SessionPhotoDto are now natively
// in generated.ts — consumed via the re-exports above.

/**
 * Request a signed upload URL for a training-session diary photo.
 * Photos land in the session-diary/{sessionId}/ bucket namespace.
 * Mirrors `generateMealPhotoUploadUrl` from nutrition.
 */
export async function generateSessionPhotoUploadUrl(
  sessionId: string,
  contentType: string,
  sizeBytes: number,
): Promise<GenerateSessionPhotoUploadUrlResponse> {
  const { data } = await api.post<GenerateSessionPhotoUploadUrlResponse>(
    `/client/training/log/sessions/${sessionId}/photo-upload-url`,
    { contentType, sizeBytes },
  );
  return data;
}

export interface SessionPhotoInput {
  blobUrl: string;
  note?: string | null;
}

export interface SaveSessionPhotosOptions {
  photos?: SessionPhotoInput[];
  note?: string | null;
}

/**
 * Replaces the photos list and note on a session log entry with the provided values.
 * REPLACE semantics — the backend sets Photos to exactly the submitted list.
 * UploadedAt is preserved for URLs that already exist in the log.
 * Mirrors `saveMealPhotos` from nutrition.
 */
export async function saveSessionPhotos(
  sessionId: string,
  opts: SaveSessionPhotosOptions = {},
): Promise<void> {
  await api.post(`/client/training/log/sessions/${sessionId}/photos`, opts);
}
