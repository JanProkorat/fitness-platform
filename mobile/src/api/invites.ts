import { api } from '@/api/client';
import type { ClientInviteDto, GetPublicProfileResponse } from '@/api/generated';

export type ClientInvite = ClientInviteDto;
export type InviteCoachProfile = GetPublicProfileResponse;

export const INVITES_QUERY_KEY = ['invites'] as const;
export const inviteCoachQueryKey = (coachPublicId: string) => ['invite-coach', coachPublicId] as const;

/** Pending invitations addressed to the signed-in client, newest first. */
export async function fetchInvites(signal?: AbortSignal): Promise<ClientInvite[]> {
  const response = await api.getClientInvitesEndpoint(signal);
  return response.items ?? [];
}

export function acceptInvite(id: string): Promise<void> {
  return api.acceptClientInviteEndpoint(id);
}

export function declineInvite(id: string): Promise<void> {
  return api.declineClientInviteEndpoint(id);
}

/** The inviting coach's public profile; used only to enrich the invite detail. */
export function fetchInviteCoach(coachPublicId: string, signal?: AbortSignal): Promise<InviteCoachProfile> {
  return api.getPublicProfileEndpoint(coachPublicId, signal);
}
