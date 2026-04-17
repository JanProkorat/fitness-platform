import api from './client';
import type {
  ProfessionalSummaryDto,
  GetPublicProfileResponse,
  SearchProfessionalsResponse,
  ClientRequestDto,
} from './generated';

// Re-export generated types so consumer imports (`from '@/api/professionals'`) still work.
export type { ProfessionalSummaryDto, GetPublicProfileResponse, SearchProfessionalsResponse, ClientRequestDto };

/**
 * @deprecated Use `ProfessionalSummaryDto` from generated. Kept as alias for backward compatibility.
 */
export type ProfessionalSummary = ProfessionalSummaryDto;

/**
 * @deprecated Use `GetPublicProfileResponse` from generated. Kept as alias for backward compatibility.
 */
export type ProfessionalProfile = GetPublicProfileResponse;

/**
 * @deprecated Use `SearchProfessionalsResponse` from generated. Kept as alias for backward compatibility.
 */
export type SearchResponse = SearchProfessionalsResponse;

/** Client-only: query parameters for professional search. No generated equivalent. */
export interface SearchParams {
  city?: string;
  specialization?: string;
  role?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function searchProfessionals(params: SearchParams = {}): Promise<SearchProfessionalsResponse> {
  const { data } = await api.get('/professionals/search', { params });
  return data;
}

export async function getProfessionalProfile(publicId: string): Promise<GetPublicProfileResponse> {
  const { data } = await api.get(`/professionals/${publicId}`);
  return data;
}

export async function sendClientRequest(professionalPublicId: string, message?: string): Promise<void> {
  await api.post('/client/requests', { professionalPublicId, message });
}

export async function getMyRequests(): Promise<ClientRequestDto[]> {
  const { data } = await api.get('/client/requests');
  return data.requests ?? [];
}

export async function cancelClientRequest(publicId: string): Promise<void> {
  await api.delete(`/client/requests/${publicId}`);
}
