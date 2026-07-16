import api from '@/lib/api';
import type {
  SectionTemplateResponse,
  CreateSectionTemplateRequest,
  UpdateSectionTemplateRequest,
  ListSectionTemplatesResponse,
  PublicWorkoutTemplateResponse,
} from '@/api/generated';

export type {
  SectionTemplateResponse,
  CreateSectionTemplateRequest,
  UpdateSectionTemplateRequest,
  PublicWorkoutTemplateResponse,
};

/** Result of {@link listSectionTemplates} — the trainer's own templates plus the public library. */
export interface SectionTemplatesListResult {
  /** The calling trainer's own section templates (unchanged shape/semantics). */
  ownTemplates: SectionTemplateResponse[];
  /** Public workout templates available to all trainers, embedded in full. */
  publicWorkoutTemplates: PublicWorkoutTemplateResponse[];
}

/**
 * List section templates for the authenticated trainer, plus the public
 * workout template library. Backend caps pageSize at 200.
 */
export async function listSectionTemplates(): Promise<SectionTemplatesListResult> {
  const { data } = await api.get<ListSectionTemplatesResponse>('/training/section-templates', {
    params: { page: 1, pageSize: 200 },
  });
  return {
    ownTemplates: data.ownTemplates ?? [],
    publicWorkoutTemplates: data.publicWorkoutTemplates ?? [],
  };
}

/** Get a single section template by ID. */
export async function getSectionTemplate(templateId: string): Promise<SectionTemplateResponse> {
  const { data } = await api.get<SectionTemplateResponse>(
    `/training/section-templates/${templateId}`,
  );
  return data;
}

/** Create a new section template. */
export async function createSectionTemplate(
  request: CreateSectionTemplateRequest,
): Promise<SectionTemplateResponse> {
  const { data } = await api.post<SectionTemplateResponse>('/training/section-templates', request);
  return data;
}

/** Update an existing section template. */
export async function updateSectionTemplate(
  templateId: string,
  request: UpdateSectionTemplateRequest,
): Promise<SectionTemplateResponse> {
  const { data } = await api.put<SectionTemplateResponse>(
    `/training/section-templates/${templateId}`,
    request,
  );
  return data;
}

/** Delete a section template. */
export async function deleteSectionTemplate(templateId: string): Promise<void> {
  await api.delete(`/training/section-templates/${templateId}`);
}
