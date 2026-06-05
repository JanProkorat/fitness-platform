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
import type { LoggedSetDto } from './wod-types';

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
  /**
   * Exercises in this section. Uses `FullPlanExercise` so call sites can
   * read `hasModifications` and augmented `sets` (actual + planned + isModified)
   * without extra casts. The generated shape is a subset, so the widening is safe.
   * (#440 — drop cast once regen surfaces these fields in generated.ts natively).
   */
  exercises?: FullPlanExercise[];
};

/**
 * Augmented SessionDto — propagates SectionDto augmentation so
 * `response.weeks[i].sessions[j].sections[k].formatConfig` is typed correctly
 * without per-call casts.
 * Also adds `lockState` (#382) and `hasModifications` (#440).
 * Drop once regen produces these fields natively.
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
  /**
   * True when at least one exercise in this session has hasModifications == true.
   * Always false when no workout log exists for this session.
   * Hand-declared until regen-api surfaces this field natively (#440).
   */
  hasModifications?: boolean;
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
  LoggedSetDto,
  UpdateWorkoutSetWithPlannedRequest,
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
 *   - `loggedSetsBySessionExercise` (#440): per-session, per-exercise logged sets
 *     with actual values, snapshot-planned values, and isModified flag.
 *   - `hasModificationsBySession` (#440): per-session roll-up modification flag.
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
  /**
   * Per-session, per-exercise logged sets with actual values, snapshot-planned
   * values, and backend-computed isModified flag.
   * Outer key = sessionId (string UUID), inner key = exerciseExternalId (string UUID).
   * Hand-declared until regen-api surfaces LoggedSetsBySessionExercise natively (#440).
   */
  loggedSetsBySessionExercise?: Record<string, Record<string, LoggedSetDto[]>>;
  /**
   * Per-session roll-up modification flag: true when the session has at least one
   * exercise with at least one isModified set.
   * Hand-declared until regen-api surfaces HasModificationsBySession natively (#440).
   */
  hasModificationsBySession?: Record<string, boolean>;
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
 * Augmented ExerciseDto — adds hasModifications from #440, and widens
 * `sets` from `SetDto[]` to `FullPlanSet[]` (a superset with actual values,
 * snapshot-planned values, and the isModified flag).
 *
 * Uses `Omit` to replace the generated `sets` property so TypeScript resolves
 * the narrower `FullPlanSet[]` type unambiguously (plain intersection would
 * produce `SetDto[] & FullPlanSet[]`, which TypeScript cannot narrow at call sites).
 *
 * Hand-declared until regen-api produces these fields natively.
 */
export type FullPlanExercise = Omit<ExerciseDto, 'sets'> & {
  /**
   * True when at least one set under this exercise has isModified == true.
   * Always false when no workout log exists for this exercise.
   */
  hasModifications?: boolean;
  /** Augmented sets with actual + planned values and isModified (#440). */
  sets?: FullPlanSet[];
};

/**
 * Augmented SetDto — adds actual values, snapshot-planned values, and
 * the backend-computed isModified flag introduced in #440.
 * Hand-declared until regen-api produces these fields natively in generated.ts.
 * Drop augmentation once generated.ts emits the full shape.
 */
export type FullPlanSet = SetDto & {
  // ── Actual logged values ────────────────────────────────────────────────────
  /** Actual reps completed. Null when set has not been performed. */
  actualReps?: number | null;
  /** Actual weight (kg) logged. Null when not performed. */
  actualWeightKg?: number | null;
  /** Actual RPE logged. Null when not performed. */
  actualRpe?: number | null;
  /** Actual duration (seconds) logged. Null when not performed. */
  actualDurationSeconds?: number | null;
  /** Actual distance (meters) logged. Null when not performed. */
  actualDistanceMeters?: number | null;
  // ── Snapshot-planned values ─────────────────────────────────────────────────
  /** Snapshot-planned repetitions at log time. Null for legacy logs. */
  plannedReps?: number | null;
  /** Snapshot-planned weight (kg) at log time. Null for legacy logs. */
  plannedWeightKg?: number | null;
  /** Snapshot-planned RPE at log time. Null for legacy logs. */
  plannedRpe?: number | null;
  /** Snapshot-planned duration (seconds) at log time. Null for legacy logs. */
  plannedDurationSeconds?: number | null;
  /** Snapshot-planned distance (meters) at log time. Null for legacy logs. */
  plannedDistanceMeters?: number | null;
  /**
   * Backend-computed: true when any actual field differs from its snapshot-planned
   * counterpart. Always false for legacy sets (no snapshot).
   */
  isModified?: boolean;
};

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
