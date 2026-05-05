import api from '@/lib/api';
import type { WorkoutFormat, WodConfig, SessionExercise } from './training-plan-types';

// ── Hand-written types (backend #238 adds these; regen-api will emit them
//    once the backend swagger is refreshed with the new SectionTemplates feature).
//    These mirror SectionTemplateResponse, CreateSectionTemplateRequest, and
//    UpdateSectionTemplateRequest from the backend.

/** A section template summary/detail as returned by the API. */
export interface SectionTemplateResponse {
  templateId: string;
  name: string;
  /** Default workout format. Null means Standard / no override. */
  defaultFormat: WorkoutFormat | null;
  defaultFormatConfig: WodConfig | null;
  /** Default exercises pre-populated when applying this template. */
  defaultExercises: SessionExercise[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** Paginated list response for section templates. */
export interface ListSectionTemplatesResponse {
  templates: SectionTemplateResponse[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** Request to create a new section template. */
export interface CreateSectionTemplateRequest {
  name: string;
  defaultFormat: WorkoutFormat | null;
  defaultFormatConfig: WodConfig | null;
  defaultExercises: SessionExercise[];
}

/** Request to update an existing section template. */
export interface UpdateSectionTemplateRequest {
  name: string;
  defaultFormat: WorkoutFormat | null;
  defaultFormatConfig: WodConfig | null;
  defaultExercises: SessionExercise[];
  /** Optimistic concurrency version from the last read. */
  version: number;
}

/** List section templates for the authenticated trainer (paginated). */
export async function listSectionTemplates(params: {
  page?: number;
  pageSize?: number;
}): Promise<ListSectionTemplatesResponse> {
  const { data } = await api.get<ListSectionTemplatesResponse>('/training/section-templates', { params });
  return data;
}

/** Get a single section template by ID. */
export async function getSectionTemplate(templateId: string): Promise<SectionTemplateResponse> {
  const { data } = await api.get<SectionTemplateResponse>(`/training/section-templates/${templateId}`);
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
