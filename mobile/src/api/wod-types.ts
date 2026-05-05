/**
 * WOD (Workout of the Day) domain types for time-based and format-aware training.
 *
 * These mirror the backend enums/documents introduced in #205:
 *   - WorkoutFormat (Standard | ForTime | AMRAP | EMOM | Tabata)
 *   - MovementType  (Reps | Time | Distance | RepsForTime)
 *   - WodConfig     — configuration parameters per format
 *   - WodResult     — outcome-only capture (no per-rep mid-round data)
 *
 * IMPORTANT: generated.ts does not yet include these shapes (regen-api requires
 * a running backend which is outside mobile-expo's allowlist). Once the backend
 * is running and regen-api is executed, these declarations should be replaced with
 * re-exports from generated.ts and this file removed.
 */

/**
 * Workout format / scoring methodology for a session or per-exercise override.
 * Mirrors backend WorkoutFormat enum.
 */
export type WorkoutFormat = 'Standard' | 'ForTime' | 'AMRAP' | 'EMOM' | 'Tabata';

/**
 * How performance in an exercise is measured.
 * Mirrors backend MovementType enum.
 */
export type MovementType = 'Reps' | 'Time' | 'Distance' | 'RepsForTime';

/**
 * Configuration parameters for a WOD format.
 * Only fields relevant to the chosen format are expected to be set.
 *
 * - EMOM:    intervalSeconds + totalRounds
 * - AMRAP:   timeCapSeconds
 * - ForTime: timeCapSeconds
 * - Tabata:  workSeconds + restSeconds + totalRounds
 */
export interface WodConfig {
  timeCapSeconds?: number | null;
  intervalSeconds?: number | null;
  totalRounds?: number | null;
  workSeconds?: number | null;
  restSeconds?: number | null;
}

/**
 * Outcome-only capture for a WOD format session or per-exercise result.
 * Submitted at log root (session WOD) or per exercise (per-exercise format).
 *
 * - AMRAP:   roundsCompleted + extraReps
 * - EMOM:    roundsCompleted + failedRounds
 * - Tabata:  roundsCompleted + repsByRound (total reps per round, optional)
 * - ForTime: totalTimeSeconds
 */
export interface WodResult {
  roundsCompleted?: number | null;
  extraReps?: number | null;
  totalTimeSeconds?: number | null;
  failedRounds?: number[] | null;
  repsByRound?: number[] | null;
}

/**
 * Extended SessionExercise shape that includes WOD fields from #205.
 * Extends the generated SessionExercise with the new backend fields.
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
 * Extended UpdateWorkoutExerciseRequest that includes WodResult.
 */
export interface UpdateWodExerciseRequest {
  exerciseExternalId?: string;
  exerciseName?: string;
  sets?: Array<{
    setNumber?: number;
    reps?: number | null;
    weightKg?: number | null;
    durationSeconds?: number | null;
    distanceMeters?: number | null;
    completedAt?: string | null;
  }>;
  /** WOD outcome for this exercise (when exercise has a format override). */
  wodResult?: WodResult | null;
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
