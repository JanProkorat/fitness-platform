import { api } from '@/api/client';
import type { GetProfileResponse } from '@/api/generated';

export type Profile = GetProfileResponse;

export const PROFILE_QUERY_KEY = ['me'] as const;

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
