import api from '@/lib/api';

export interface IncomingRequest {
  publicId: string;
  clientFirstName: string;
  clientLastName: string;
  clientEmail: string;
  message: string | null;
  sentAt: string;
}

export async function getIncomingRequests(): Promise<IncomingRequest[]> {
  const { data } = await api.get('/trainer/client-requests');
  return data.items;
}

export async function acceptClientRequest(publicId: string, questionnairePublicId?: string | null): Promise<void> {
  await api.post(`/trainer/client-requests/${publicId}/accept`, {
    questionnairePublicId: questionnairePublicId || null,
  });
}

export async function rejectClientRequest(publicId: string): Promise<void> {
  await api.post(`/trainer/client-requests/${publicId}/reject`);
}
