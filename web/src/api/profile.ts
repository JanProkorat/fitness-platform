import api from '@/lib/api';
import { apiClient } from '@/api/client';
import type {
  ChangePasswordRequest,
  GetProfileResponse,
  GetProfessionalProfileResponse,
} from '@/api/generated';

/** GET /users/me — current user's profile (name, phone, avatar, roles). */
export async function getMyProfile(): Promise<GetProfileResponse> {
  const { data } = await api.get<GetProfileResponse>('/users/me');
  return data;
}

/**
 * PUT /users/me — update name + phone.
 *
 * Hand-written (not the generated `UpdateProfileRequest`) because that
 * type declares `phoneNumber?: string | undefined`, which cannot express
 * "explicitly clear the phone number" — the endpoint distinguishes an
 * omitted field from an explicit `null`, and the caller needs to send the
 * latter when the user empties the phone input.
 */
export interface UpdateMyProfilePayload {
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
}

export async function updateMyProfile(payload: UpdateMyProfilePayload): Promise<void> {
  await api.put('/users/me', payload);
}

/** PUT /users/me/timezone — IANA zone id; 400 INVALID_TIME_ZONE when .NET cannot resolve it. */
export async function updateMyTimeZone(timeZone: string): Promise<void> {
  await api.put('/users/me/timezone', { timeZone });
}

/** DELETE /users/me — permanently deletes the signed-in account (204); 400 when the delete fails. */
export async function deleteMyAccount(): Promise<void> {
  await api.delete('/users/me');
}

/** Token pair returned by a password change; the old refresh tokens are revoked server-side. */
export interface ChangePasswordResult {
  accessToken: string;
  refreshToken: string;
  passwordChangedAt: string | undefined;
}

/** POST /users/me/password — 400 INVALID_CURRENT_PASSWORD / PASSWORD_NOT_SET. */
export async function changeMyPassword(payload: ChangePasswordRequest): Promise<ChangePasswordResult> {
  const result = await apiClient.changePasswordEndpoint(payload);
  if (!result.accessToken || !result.refreshToken) {
    throw new Error('Password change response carried no tokens');
  }
  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    passwordChangedAt: result.passwordChangedAt,
  };
}

/** GET /trainer/profile — trainer/nutritionist professional profile fields. */
export async function getTrainerProfile(): Promise<GetProfessionalProfileResponse> {
  const { data } = await api.get<GetProfessionalProfileResponse>('/trainer/profile');
  return data;
}

/**
 * PUT /trainer/profile — update the professional profile fields.
 *
 * Hand-written for the same reason as `UpdateMyProfilePayload` — several
 * fields are explicitly cleared with `null` when the user empties them,
 * which the generated `string | undefined` shape can't express.
 */
export interface UpdateTrainerProfilePayload {
  bio: string | null;
  specialization: string | null;
  city: string | null;
  estimatedPrice: string | null;
  specializations: string;
  certificates: string;
  languages: string;
  collaborationType: string | null;
  linkedIn: string | null;
  instagram: string | null;
  website: string | null;
  showInSearch: boolean;
  acceptNewClients: boolean;
}

export async function updateTrainerProfile(payload: UpdateTrainerProfilePayload): Promise<void> {
  await api.put('/trainer/profile', payload);
}

export const profileKeys = {
  me: ['profile', 'me'] as const,
  trainer: ['profile', 'trainer'] as const,
};
