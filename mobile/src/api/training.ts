import api from './client';
import {
  SetType,
  MuscleGroup,
} from './generated';
import type {
  ExerciseSet,
  SessionExercise,
  TrainingSession,
  GetTodaySessionResponse,
  GetFullTrainingPlanResponse,
  WeekDto,
  SessionDto,
  ExerciseDto,
  SetDto,
} from './generated';

// Re-export generated types and enums so consumer imports (`from '@/api/training'`) still work.
export { SetType, MuscleGroup };
export type {
  ExerciseSet,
  SessionExercise,
  TrainingSession,
  GetTodaySessionResponse,
  GetFullTrainingPlanResponse,
  WeekDto,
  SessionDto,
  ExerciseDto,
  SetDto,
};

/**
 * @deprecated Use `GetTodaySessionResponse` from generated. Kept as alias for backward compatibility.
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
