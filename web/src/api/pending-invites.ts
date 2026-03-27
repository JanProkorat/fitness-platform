import api from '@/lib/api';

export interface PendingInviteDto {
  publicId: string;
  firstName: string;
  lastName: string;
  email: string;
  sentAt: string;
  isAccepted: boolean;
}

export interface CreatePendingInviteRequest {
  firstName: string;
  lastName: string;
  email: string;
}

export interface CreatePendingInviteResponse {
  publicId: string;
  firstName: string;
  lastName: string;
  email: string;
  sentAt: string;
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
