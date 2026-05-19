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
 */
export type SessionDto = Omit<GeneratedSessionDto, 'sections'> & {
  sections?: SectionDto[];
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
