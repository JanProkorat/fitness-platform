/** Set type enum values. */
export type SetType = 'Normal' | 'Warmup' | 'Dropset' | 'Superset';

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
  sets: ExerciseSet[];
}

/** A training session within a week. */
export interface TrainingSession {
  sessionId: string;
  dayOfWeek: number;
  name: string;
  order: number;
  notes?: string | null;
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

/** Session data within a full-state plan update. */
export interface UpdateSessionRequest {
  sessionId?: string | null;
  dayOfWeek: number;
  name: string;
  order: number;
  notes?: string | null;
  exercises: UpdateSessionExerciseRequest[];
}

/** Exercise data within a session update. */
export interface UpdateSessionExerciseRequest {
  exerciseExternalId: string;
  exerciseName: string;
  order: number;
  notes?: string | null;
  restSeconds?: number | null;
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
