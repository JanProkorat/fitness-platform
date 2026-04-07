import api from '@/lib/api';

export interface PendingInviteDto {
  publicId: string;
  firstName: string;
  lastName: string;
  email: string;
  message?: string | null;
  sentAt: string;
  isAccepted: boolean;
  questionnairePublicId?: string | null;
  questionnaireTitle?: string | null;
}

export interface CreatePendingInviteRequest {
  firstName: string;
  lastName: string;
  email: string;
  message?: string | null;
  questionnairePublicId?: string | null;
}

export interface CreatePendingInviteResponse {
  publicId: string;
  firstName: string;
  lastName: string;
  email: string;
  sentAt: string;
  questionnairePublicId?: string | null;
}

export interface GetPendingInvitesResponse {
  invites: PendingInviteDto[];
}

export async function createPendingInvite(
  request: CreatePendingInviteRequest,
): Promise<CreatePendingInviteResponse> {
  const { data } = await api.post<CreatePendingInviteResponse>(
    '/trainer/pending-invites',
    request,
  );
  return data;
}

export async function getPendingInvites(): Promise<GetPendingInvitesResponse> {
  const { data } = await api.get<GetPendingInvitesResponse>(
    '/trainer/pending-invites',
  );
  return data;
}

export async function deletePendingInvite(id: string): Promise<void> {
  await api.delete(`/trainer/pending-invites/${id}`);
}
