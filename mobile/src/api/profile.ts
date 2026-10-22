import { api } from '@/api/client';
import type { GetClientProfileSummaryResponse, GetProfileResponse } from '@/api/generated';

export type Profile = GetProfileResponse;
export type ProfileSummary = GetClientProfileSummaryResponse;

export const PROFILE_QUERY_KEY = ['me'] as const;
export const PROFILE_SUMMARY_QUERY_KEY = ['profile', 'summary'] as const;

/** Loads the client's Profile headline numbers (GET /client/profile/summary). */
export function fetchProfileSummary(signal?: AbortSignal): Promise<ProfileSummary> {
  return api.getClientProfileSummaryEndpoint(signal);
}

export const ROLE_CLIENT = 'Client';
export const ROLE_TRAINER = 'Trainer';
export const ROLE_NUTRITIONIST = 'Nutritionist';

/** Loads the signed-in user's profile (GET /users/me). */
export function fetchProfile(signal?: AbortSignal): Promise<Profile> {
  return api.getProfileEndpoint(signal);
}

/** True when the profile carries the Client role. */
export function isClientProfile(profile: Profile): boolean {
  return (profile.roles ?? []).includes(ROLE_CLIENT);
}
