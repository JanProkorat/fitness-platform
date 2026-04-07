import api from './client';

export interface ProfessionalSummary {
  publicId: string;
  firstName: string;
  lastName: string;
  bio: string | null;
  specializations: string[];
  city: string | null;
  estimatedPrice: string | null;
  collaborationType: string | null;
  languages: string[];
  roles: string[];
  /** @deprecated legacy field — use `roles` after backend update */
  role?: string;
}

export interface ProfessionalProfile {
  publicId: string;
  firstName: string;
  lastName: string;
  bio: string | null;
  specializations: string[];
  certificates: string[];
  languages: string[];
  city: string | null;
  estimatedPrice: string | null;
  collaborationType: string | null;
  linkedIn: string | null;
  instagram: string | null;
  website: string | null;
  roles: string[];
  hasPendingRequest: boolean;
  isLinked: boolean;
}

export interface SearchParams {
  city?: string;
  specialization?: string;
  role?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface SearchResponse {
  items: ProfessionalSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export async function searchProfessionals(params: SearchParams = {}): Promise<SearchResponse> {
  const { data } = await api.get('/professionals/search', { params });
  return data;
}

export async function getProfessionalProfile(publicId: string): Promise<ProfessionalProfile> {
  const { data } = await api.get(`/professionals/${publicId}`);
  return data;
}

export async function sendClientRequest(professionalPublicId: string, message?: string): Promise<void> {
  await api.post('/client/requests', { professionalPublicId, message });
}

export interface ClientRequestDto {
  publicId: string;
  professionalPublicId: string;
  professionalName: string;
  message: string | null;
  status: string;
  sentAt: string;
  respondedAt: string | null;
}

export async function getMyRequests(): Promise<ClientRequestDto[]> {
  const { data } = await api.get('/client/requests');
  return data.requests ?? [];
}

export async function cancelClientRequest(publicId: string): Promise<void> {
  await api.delete(`/client/requests/${publicId}`);
}
