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
  GetFullTrainingPlanResponse as GeneratedFullTrainingPlanResponse,
  WeekDto as GeneratedWeekDto,
  SessionDto as GeneratedSessionDto,
  SectionDto as GeneratedSectionDto,
  ExerciseDto,
  SetDto,
  WodConfig,
} from './generated';

// Re-export generated types and enums so consumer imports (`from '@/api/training'`) still work.
export { SetType, MuscleGroup, WorkoutFormat, MovementType };
export type {
  ExerciseSet,
  SessionExercise,
  TrainingSession,
  GetTodaySessionResponse,
  ExerciseDto,
  SetDto,
  WodConfig,
};

/**
 * Augmented SectionDto — adds `formatConfig`, `notes`, and `isCompleted` that
 * the backend now emits but NSwag hasn't been re-run for yet.
 * Drop the augmentation fields once the generated client is regenerated
 * and the fields appear on GeneratedSectionDto directly.
 */
export type SectionDto = Omit<GeneratedSectionDto, 'exercises'> & {
  formatConfig?: WodConfig | null;
  notes?: string | null;
  /** True when the backend considers this section fully complete.
   * For sections with exercises: every exercise has IsCompleted=true.
   * For sections without exercises: the section id is in
   * TrainingCompletion.CompletedSectionIds (#260 fix). */
  isCompleted?: boolean;
  exercises?: GeneratedSectionDto['exercises'];
};

/**
 * Augmented SessionDto — propagates SectionDto augmentation so
 * `response.weeks[i].sessions[j].sections[k].formatConfig` is typed correctly
 * without per-call casts.
 * Also adds `lockState` which the backend (#382) now includes in GetFullTrainingPlan
 * responses. Drop once regen produces this field natively.
 */
export type SessionDto = Omit<GeneratedSessionDto, 'sections'> & {
  sections?: SectionDto[];
  /**
   * Session edit-lock state from the backend.
   * "Stable"  — no active lock; normal operation.
   * "Editing" — a trainer currently holds the edit lock; banner should be shown.
   * "Live"    — the client's own live session is in progress; no banner.
   * Defaults to "Stable" when the field is absent (pre-#382 response shape).
   */
  lockState?: string;
};

/**
 * Augmented WeekDto — propagates SessionDto augmentation up the chain.
 */
export type WeekDto = Omit<GeneratedWeekDto, 'sessions'> & {
  sessions?: SessionDto[];
};

/**
 * Augmented GetFullTrainingPlanResponse — propagates WeekDto augmentation up the chain.
 */
export type GetFullTrainingPlanResponse = Omit<GeneratedFullTrainingPlanResponse, 'weeks'> & {
  weeks?: WeekDto[];
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

// Re-export WodResult from wod-types (hand-declared until fully superseded by generated).
export type {
  WodResult,
  WodSessionExercise,
} from './wod-types';

/**
 * A single training-session diary photo from the session log.
 * Mirrors `MealPhotoDto` from nutrition (blobUrl, uploadedAt, note?).
 *
 * Hand-declared until regen-api is run against the backend (#405).
 * Drop this type once generated.ts emits `SessionPhotoDto` natively.
 */
export interface SessionPhotoDto {
  blobUrl: string;
  uploadedAt?: string;
  note?: string | null;
}

/**
 * Augmented GetTodaySessionResponse — adds:
 *   - `lockStateBySession` (#382): session edit-lock state.
 *   - `photosBySession` (#405): per-session diary photos from the session log.
 *   - `notesBySession` (#405): persisted session-level notes keyed by sessionId.
 *
 * All fields hand-declared until regen-api runs against the updated backend.
 * Drop the augmentation for each field once the generated client emits it natively.
 */
export type TodayTrainingResponse = GetTodaySessionResponse & {
  lockStateBySession?: Record<string, string>;
  /**
   * Per-session diary photos from today's session logs, keyed by sessionId.
   * Mirrors how `mealsEaten[].photos` is embedded in GetTodayLogResponse for nutrition.
   * Added in #405 (GenerateSessionPhotoUploadUrl + SaveSessionPhotos endpoints).
   * Returns an empty object when no session has any diary photos today.
   */
  photosBySession?: Record<string, SessionPhotoDto[]>;
  /**
   * Persisted session-level note for today's session log, keyed by sessionId.
   * Only present for sessions that have a non-empty note — mirrors how
   * nutrition's today read path returns each meal's note.
   * Added in #405 review fix: seeds the note textarea so REPLACE semantics
   * do not wipe previously saved notes on re-open.
   */
  notesBySession?: Record<string, string>;
};

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
 * @deprecated Use `ExerciseDto` from generated. Kept as alias for backward compatibility.
 */
export type FullPlanExercise = ExerciseDto;

/**
 * @deprecated Use `SetDto` from generated. Kept as alias for backward compatibility.
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

export interface GenerateSessionPhotoUploadUrlResponse {
  uploadUrl: string;
  blobUrl: string;
}

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
