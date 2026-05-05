import api from '@/lib/api';
import type {
  SectionTemplateResponse,
  CreateSectionTemplateRequest,
  UpdateSectionTemplateRequest,
} from '@/api/generated';

export type { SectionTemplateResponse, CreateSectionTemplateRequest, UpdateSectionTemplateRequest };

/** List section templates for the authenticated trainer. */
export async function listSectionTemplates(): Promise<SectionTemplateResponse[]> {
  const { data } = await api.get<SectionTemplateResponse[]>('/training/section-templates', {
    params: { page: 1, pageSize: 500 },
  });
  return data;
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
