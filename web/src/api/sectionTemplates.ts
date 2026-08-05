import api from '@/lib/api';
import type {
  WorkoutTemplateResponse,
  CreateWorkoutTemplateRequest,
  UpdateWorkoutTemplateRequest,
  ListWorkoutTemplatesResponse,
} from '@/api/generated';

export type {
  WorkoutTemplateResponse,
  CreateWorkoutTemplateRequest,
  UpdateWorkoutTemplateRequest,
};

/**
 * List workout templates for the authenticated trainer. Backend caps
 * pageSize at 200.
 */
export async function listSectionTemplates(): Promise<WorkoutTemplateResponse[]> {
  const { data } = await api.get<ListWorkoutTemplatesResponse>('/training/workout-templates', {
    params: { page: 1, pageSize: 200 },
  });
  return data.ownTemplates ?? [];
}

/** Get a single workout template by ID. */
export async function getSectionTemplate(templateId: string): Promise<WorkoutTemplateResponse> {
  const { data } = await api.get<WorkoutTemplateResponse>(
    `/training/workout-templates/${templateId}`,
  );
  return data;
}

/** Create a new workout template. */
export async function createSectionTemplate(
  request: CreateWorkoutTemplateRequest,
): Promise<WorkoutTemplateResponse> {
  const { data } = await api.post<WorkoutTemplateResponse>('/training/workout-templates', request);
  return data;
}

/** Update an existing workout template. */
export async function updateSectionTemplate(
  templateId: string,
  request: UpdateWorkoutTemplateRequest,
): Promise<WorkoutTemplateResponse> {
  const { data } = await api.put<WorkoutTemplateResponse>(
    `/training/workout-templates/${templateId}`,
    request,
  );
  return data;
}

/** Delete a workout template. */
export async function deleteSectionTemplate(templateId: string): Promise<void> {
  await api.delete(`/training/workout-templates/${templateId}`);
}
