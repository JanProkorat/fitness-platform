/**
 * WOD (Workout of the Day) domain types for time-based and format-aware training.
 *
 * These mirror the backend enums/documents introduced in #205:
 *   - WorkoutFormat (Standard | ForTime | AMRAP | EMOM | Tabata)
 *   - MovementType  (Reps | Time | Distance | RepsForTime)
 *   - WodConfig     — configuration parameters per format
 *   - WodResult     — outcome-only capture (no per-rep mid-round data)
 *
 * After the #440 regen, `WodResult`, `WodConfig`, `WorkoutFormat`, `MovementType`,
 * `LoggedSetDto`, and `UpdateWorkoutSetRequest` (with planned fields) are all
 * emitted natively by generated.ts.  This file re-exports the canonical shapes
 * and retains only the genuinely-additive hand-maintained types.
 */

// ── Re-exports from generated.ts ────────────────────────────────────────────
// These were hand-declared here before #440 regen; generated.ts is now the
// single source of truth.
import type { WodResult, WodConfig, LoggedSetDto, UpdateWorkoutSetRequest } from './generated';
import { WorkoutFormat, MovementType } from './generated';
export type { WodResult, WodConfig, LoggedSetDto, UpdateWorkoutSetRequest };
export { WorkoutFormat, MovementType };

/**
 * Extended SessionExercise shape that includes WOD fields from #205.
 * Extends the generated SessionExercise with the new backend fields.
 *
 * Still hand-maintained: this is the *plan prescription* shape for the live
 * session screen, which uses SessionExercise (not ExerciseDto / SetDto).
 */
export interface WodSessionExercise {
  exerciseExternalId?: string;
  exerciseName?: string;
  order?: number;
  notes?: string | null;
  restSeconds?: number | null;
  sets?: Array<{
    setNumber?: number;
    reps?: number | null;
    weightKg?: number | null;
    durationSeconds?: number | null;
    distanceMeters?: number | null;
    restSeconds?: number | null;
  }>;
  /** How performance for this exercise is measured. Defaults to Reps. */
  movementType?: MovementType;
  /** Per-exercise format override. Null means inherit the session format. */
  format?: WorkoutFormat | null;
  /** Per-exercise format config. Null when format is null or Standard. */
  formatConfig?: WodConfig | null;
}

/**
 * Extended UpdateWorkoutExerciseRequest that includes WodResult and the
 * generated UpdateWorkoutSetRequest (which now carries planned fields natively).
 *
 * `sectionId` is hand-maintained here pending the next regen (#469).
 * The backend's UpdateWorkoutExerciseRequest gained a nullable SectionId (Guid)
 * in #469 so the write path can key logged exercises by (SectionId, ExerciseExternalId)
 * instead of ExerciseExternalId alone. A future regen will emit this field natively
 * from generated.ts — mirror the comment style in this file when it lands.
 */
export interface UpdateWodExerciseRequest {
  exerciseExternalId?: string;
  exerciseName?: string;
  sets?: UpdateWorkoutSetRequest[];
  /** WOD outcome for this exercise (when exercise has a format override). */
  wodResult?: WodResult | null;
  /**
   * The section (workout) this exercise belongs to — matches TrainingSection.sectionId.
   * Optional: absent for legacy single-section logs (backend treats missing as the
   * legacy flat-exercise behaviour). Added in #469; fold into generated.ts on next regen.
   */
  sectionId?: string;
}

/**
 * Extended UpdateWorkoutRequest that includes WodResult at root + per-exercise.
 */
export interface UpdateWorkoutWodRequest {
  mood?: number | null;
  notes?: string | null;
  exercises?: UpdateWodExerciseRequest[];
  /** WOD outcome for the whole session (when session has a non-Standard format). */
  wodResult?: WodResult | null;
}
