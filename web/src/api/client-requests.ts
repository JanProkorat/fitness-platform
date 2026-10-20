import api from '@/lib/api';
import type { GetIncomingRequestsResponse, IncomingClientRequestDto } from '@/api/generated';

export type { IncomingClientRequestDto };

export async function getIncomingRequests(): Promise<IncomingClientRequestDto[]> {
  const { data } = await api.get<GetIncomingRequestsResponse>('/trainer/client-requests');
  return data.requests ?? [];
}

export async function acceptClientRequest(publicId: string, questionnairePublicId?: string | null, statement?: string): Promise<void> {
  await api.post(`/trainer/client-requests/${publicId}/accept`, {
    questionnairePublicId: questionnairePublicId || null,
    statement: statement || null,
  });
}

export async function rejectClientRequest(publicId: string, statement?: string): Promise<void> {
  await api.post(`/trainer/client-requests/${publicId}/reject`, {
    statement: statement ?? null,
  });
}
