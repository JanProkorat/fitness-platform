import { api } from '@/api/client';
import type { CollaborationDto } from '@/api/generated';

export type Collaboration = CollaborationDto;

export const COLLABORATIONS_QUERY_KEY = ['collaborations'] as const;

/** The coaches the signed-in client works with (GET /client/collaborations). */
export async function fetchCollaborations(signal?: AbortSignal): Promise<Collaboration[]> {
  const response = await api.getCollaborationsEndpoint(signal);
  return response.collaborations ?? [];
}
