import api from './client';
import type {
  UpdateProfileRequest,
  GetComplianceScoreResponse,
  CollaborationDto,
} from './generated';

// Re-export generated types so consumer imports (`from '@/api/profile'`) still work.
export type { UpdateProfileRequest, CollaborationDto };

/** @deprecated Legacy alias — prefer `GetComplianceScoreResponse` from generated. */
export type ComplianceScoreResponse = GetComplianceScoreResponse;

// --- API calls ---

export async function getComplianceScore(params?: {
  from?: string
  to?: string
}): Promise<GetComplianceScoreResponse> {
  const { data } = await api.get<GetComplianceScoreResponse>(
    '/client/progress/compliance',
    { params },
  )
  return data
}

export async function updateProfile(body: UpdateProfileRequest): Promise<void> {
  await api.put('/users/me', body)
}

// --- Collaborations ---

export async function getCollaborations(): Promise<CollaborationDto[]> {
  const { data } = await api.get('/client/collaborations')
  return data.collaborations ?? []
}

export async function endCollaboration(publicId: string): Promise<void> {
  await api.delete(`/client/collaborations/${publicId}`)
}
