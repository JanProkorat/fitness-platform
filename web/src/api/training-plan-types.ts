/** Set type enum values. */
export type SetType = 'Normal' | 'Warmup' | 'Dropset' | 'Superset';

/**
 * Workout format / scoring methodology for a session or exercise.
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
 */
export interface WodConfig {
  timeCapSeconds?: number | null;
  intervalSeconds?: number | null;
  totalRounds?: number | null;
  workSeconds?: number | null;
  restSeconds?: number | null;
}

/**
 * Records the outcome of a WOD format session or exercise.
 * Only fields relevant to the actual result need to be set.
 */
export interface WodResult {
  roundsCompleted?: number | null;
  extraReps?: number | null;
  totalTimeSeconds?: number | null;
  failedRounds?: number[] | null;
  repsByRound?: number[] | null;
}

/** A single set within an exercise. */
export interface ExerciseSet {
  setNumber: number;
  type: SetType;
  reps?: number | null;
  weightKg?: number | null;
  durationSeconds?: number | null;
  rpe?: number | null;
  distanceMeters?: number | null;
  restSeconds?: number | null;
}

/** An exercise within a training session (denormalized snapshot). */
export interface SessionExercise {
  exerciseExternalId: string;
  exerciseName: string;
  order: number;
  notes?: string | null;
  restSeconds?: number | null;
  /** How performance for this exercise is measured. Defaults to Reps. */
  movementType: MovementType;
  /** Per-exercise format override. Null means inherit session format. */
  format?: WorkoutFormat | null;
  /** Per-exercise format config. Null when format is null or Standard. */
  formatConfig?: WodConfig | null;
  sets: ExerciseSet[];
}

/**
 * An ordered section within a training session (e.g. "Warm-up", "Hlavní").
 * The editor always works with sections — legacy plans without sections are
 * wrapped in a single synthetic "Hlavní" section on load.
 */
export interface TrainingSection {
  /** Stable client-side identifier; reused across saves. New sections get crypto.randomUUID(). */
  sectionId: string;
  /** Display order within the session (0-based). */
  order: number;
  /** Display name (e.g. "Hlavní", "Rozcvička"). */
  name: string;
  /** Section-level workout format. Defaults to Standard. */
  format: WorkoutFormat;
  /** Format config. Null when format is Standard. */
  formatConfig?: WodConfig | null;
  /** Optional coach notes for this section. */
  notes?: string | null;
  /** Exercises in this section. */
  exercises: SessionExercise[];
}

/** A training session within a week. */
export interface TrainingSession {
  sessionId: string;
  dayOfWeek: number;
  name: string;
  order: number;
  notes?: string | null;
  /** Session-level workout format (kept as inheritable default). */
  format: WorkoutFormat;
  /** Session-level format config. */
  formatConfig?: WodConfig | null;
  /**
   * Sections in this session. The editor always works with sections.
   * Legacy plans (flat exercises, no sections) are wrapped on load.
   */
  sections: TrainingSection[];
  /**
   * Flat view of exercises across all sections — present on API response
   * objects only (computed, not stored). The store does not use this field;
   * it reads from sections instead.
   */
  exercises: SessionExercise[];
}

/** A week within the training plan. */
export interface TrainingWeek {
  weekNumber: number;
  status: 'Draft' | 'Published';
  datePublished?: string | null;
  sessions: TrainingSession[];
  dayNotes?: Record<number, string> | null;
}

/** Full training plan detail. */
export interface TrainingPlanDetail {
  planId: string;
  clientId: string;
  trainerId: string;
  name: string;
  description?: string | null;
  status: 'Draft' | 'Active' | 'Completed' | 'Archived';
  weeks: TrainingWeek[];
  version: number;
  dateCreated: string;
  dateUpdated?: string | null;
  startDate?: string | null;
  dateCompleted?: string | null;
  questionnaireResponseId?: string | null;
}

/** Training plan summary for list views. */
export interface TrainingPlanSummary {
  planId: string;
  name: string;
  description?: string | null;
  clientId: string;
  status: 'Draft' | 'Active' | 'Completed' | 'Archived';
  weekCount: number;
  version: number;
  dateCreated: string;
  dateUpdated?: string | null;
  startDate?: string | null;
  dateCompleted?: string | null;
  questionnaireResponseId?: string | null;
}

/** Paginated training plan list response. */
export interface GetTrainingPlansResponse {
  plans: TrainingPlanSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** Request to create a new training plan. */
export interface CreateTrainingPlanRequest {
  clientId: string;
  name: string;
  description?: string | null;
  weekCount?: number;
  startDate?: string | null;
  questionnaireResponseId?: string | null;
}

/** Request to update a training plan (full state). */
export interface UpdateTrainingPlanRequest {
  name: string;
  description?: string | null;
  weeks: UpdateTrainingWeekRequest[];
  version: number;
  startDate?: string | null;
}

/** Week data within a full-state plan update. */
export interface UpdateTrainingWeekRequest {
  weekNumber: number;
  sessions: UpdateSessionRequest[];
  dayNotes?: Record<number, string> | null;
}

/** Section data within a session update. */
export interface UpdateSectionRequest {
  /** Stable section identifier. Pass the existing ID to preserve identity across saves. */
  sectionId?: string | null;
  /** Display order within the session (0-based). */
  order: number;
  /** Display name of the section (e.g. "Hlavní", "Warm-up"). */
  name: string;
  /** Workout format for this section. Null means inherit the session-level format. */
  format?: WorkoutFormat | null;
  /** Format configuration. Null when format is null or Standard. */
  formatConfig?: WodConfig | null;
  /** Exercises belonging to this section. */
  exercises: UpdateSessionExerciseRequest[];
}

/** Session data within a full-state plan update. */
export interface UpdateSessionRequest {
  sessionId?: string | null;
  dayOfWeek: number;
  name: string;
  order: number;
  notes?: string | null;
  format: WorkoutFormat;
  formatConfig?: WodConfig | null;
  /** Ordered sections in this session. Must be non-empty. */
  sections: UpdateSectionRequest[];
}

/** Exercise data within a session update. */
export interface UpdateSessionExerciseRequest {
  exerciseExternalId: string;
  exerciseName: string;
  order: number;
  notes?: string | null;
  restSeconds?: number | null;
  movementType: MovementType;
  format?: WorkoutFormat | null;
  formatConfig?: WodConfig | null;
  sets: UpdateExerciseSetRequest[];
}

/** Set data within an exercise update. */
export interface UpdateExerciseSetRequest {
  setNumber: number;
  type: SetType;
  reps?: number | null;
  weightKg?: number | null;
  durationSeconds?: number | null;
  rpe?: number | null;
  distanceMeters?: number | null;
  restSeconds?: number | null;
}

/** Exercise progress data point. */
export interface ExerciseProgressPoint {
  date: string;
  bestWeightKg?: number | null;
  bestReps?: number | null;
  totalVolume: number;
  hasPR: boolean;
}

/** Exercise progress response. */
export interface ExerciseProgressResponse {
  exerciseName: string;
  dataPoints: ExerciseProgressPoint[];
}
