import api from './client';

// --- Types ---

export interface ExerciseSet {
  setNumber: number;
  type: 'Normal' | 'Warmup' | 'Dropset' | 'Superset';
  reps?: number | null;
  weightKg?: number | null;
  durationSeconds?: number | null;
  rpe?: number | null;
  distanceMeters?: number | null;
}

export interface SessionExercise {
  exerciseExternalId: string;
  exerciseName: string;
  order: number;
  notes?: string | null;
  restSeconds?: number | null;
  sets: ExerciseSet[];
}

export interface TrainingSession {
  sessionId: string;
  dayOfWeek: number;
  name: string;
  order: number;
  notes?: string | null;
  exercises: SessionExercise[];
}

export interface TodayTrainingResponse {
  hasSession: boolean;
  planId?: string | null;
  planName?: string | null;
  session?: TrainingSession | null;
  currentWeek?: number | null;
  totalWeeks?: number | null;
  status?: 'Draft' | 'Active' | 'Completed' | 'Archived';
  questionnaireResponseId?: string | null;
  dateCompleted?: string | null;
}

// --- API calls ---

export async function getTodaySession(): Promise<TodayTrainingResponse> {
  const { data } = await api.get<TodayTrainingResponse>('/client/training/plan/today');
  return data;
}
