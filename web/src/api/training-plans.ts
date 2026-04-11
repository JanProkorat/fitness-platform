import api from '@/lib/api';
import type {
  TrainingPlanDetail,
  GetTrainingPlansResponse,
  CreateTrainingPlanRequest,
  UpdateTrainingPlanRequest,
  ExerciseProgressResponse,
} from './training-plan-types';

/** Fetch paginated list of training plans. */
export async function getTrainingPlans(params: {
  clientId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<GetTrainingPlansResponse> {
  const { data } = await api.get<GetTrainingPlansResponse>('/training/plans', { params });
  return data;
}

/** Get a single training plan by ID. */
export async function getTrainingPlan(planId: string): Promise<TrainingPlanDetail> {
  const { data } = await api.get<TrainingPlanDetail>(`/training/plans/${planId}`);
  return data;
}

/** Create a new training plan. */
export async function createTrainingPlan(request: CreateTrainingPlanRequest): Promise<TrainingPlanDetail> {
  const { data } = await api.post<TrainingPlanDetail>('/training/plans', request);
  return data;
}

/** Full-state update of a training plan. */
export async function updateTrainingPlan(
  planId: string,
  request: UpdateTrainingPlanRequest,
): Promise<TrainingPlanDetail> {
  const { data } = await api.put<TrainingPlanDetail>(`/training/plans/${planId}`, request);
  return data;
}

/** Delete a training plan. */
export async function deleteTrainingPlan(planId: string): Promise<void> {
  await api.delete(`/training/plans/${planId}`);
}

/** Mark a training plan as completed. */
export async function completeTrainingPlan(
  planId: string,
  version: number,
): Promise<TrainingPlanDetail> {
  const { data } = await api.post<TrainingPlanDetail>(
    `/training/plans/${planId}/complete`,
    { version },
  );
  return data;
}

/** Link or unlink a questionnaire response to a training plan. */
export async function linkTrainingQuestionnaire(
  planId: string,
  questionnaireResponseId: string | null,
  version: number,
): Promise<TrainingPlanDetail> {
  const { data } = await api.put<TrainingPlanDetail>(
    `/training/plans/${planId}/link-questionnaire`,
    { questionnaireResponseId, version },
  );
  return data;
}

/** Publish a single week of a training plan. */
export async function publishTrainingWeek(
  planId: string,
  weekNumber: number,
  version: number,
): Promise<TrainingPlanDetail> {
  const { data } = await api.post<TrainingPlanDetail>(
    `/training/plans/${planId}/weeks/${weekNumber}/publish`,
    { version },
  );
  return data;
}

/** Get exercise progress for a client. */
export async function getExerciseProgress(
  clientId: string,
  exerciseId: string,
): Promise<ExerciseProgressResponse> {
  const { data } = await api.get<ExerciseProgressResponse>(
    `/training/clients/${clientId}/progress/${exerciseId}`,
  );
  return data;
}
