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
 * Per-set request payload with snapshot-planned fields (#441 / backend #440).
 *
 * Hand-declared until regen-api is run against the backend that includes
 * these fields on UpdateWorkoutSetRequest.  Drop the augmentation once
 * generated.ts emits the planned fields natively.
 */
export interface UpdateWorkoutSetWithPlannedRequest {
  setNumber?: number;
  /** Actual reps completed. */
  reps?: number | null;
  /** Actual weight in kg. */
  weightKg?: number | null;
  /** Rate of Perceived Exertion (1-10). */
  rpe?: number | null;
  /** Duration in seconds. */
  durationSeconds?: number | null;
  /** Distance in meters. */
  distanceMeters?: number | null;
  /** When this set was completed. */
  completedAt?: string | null;
  // ── Snapshot-planned fields — frozen from plan prescription at log time ──────
  /** Prescribed repetitions from the plan (snapshot). */
  plannedReps?: number | null;
  /** Prescribed weight (kg) from the plan (snapshot). */
  plannedWeightKg?: number | null;
  /** Prescribed RPE from the plan (snapshot). */
  plannedRpe?: number | null;
  /** Prescribed duration in seconds from the plan (snapshot). */
  plannedDurationSeconds?: number | null;
  /** Prescribed distance in meters from the plan (snapshot). */
  plannedDistanceMeters?: number | null;
}

/**
 * Extended UpdateWorkoutExerciseRequest that includes WodResult and planned-field sets.
 */
export interface UpdateWodExerciseRequest {
  exerciseExternalId?: string;
  exerciseName?: string;
  sets?: UpdateWorkoutSetWithPlannedRequest[];
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

/**
 * Per-set read DTO with actual values, snapshot-planned values, and the
 * backend-computed isModified flag (#441 / backend #440).
 *
 * Hand-declared until regen-api is run.  Used by GetTodaySession
 * (loggedSetsBySessionExercise) and GetFullTrainingPlan.
 */
export interface LoggedSetDto {
  /** 1-based set number within the exercise. */
  setNumber: number;
  // ── Actual logged values ───────────────────────────────────────────────────
  actualReps?: number | null;
  actualWeightKg?: number | null;
  actualRpe?: number | null;
  actualDurationSeconds?: number | null;
  actualDistanceMeters?: number | null;
  // ── Snapshot-planned values ────────────────────────────────────────────────
  plannedReps?: number | null;
  plannedWeightKg?: number | null;
  plannedRpe?: number | null;
  plannedDurationSeconds?: number | null;
  plannedDistanceMeters?: number | null;
  /**
   * Backend-computed: true when any actual field differs from its
   * snapshot-planned counterpart.  Always false for legacy sets (no snapshot).
   */
  isModified: boolean;
}
