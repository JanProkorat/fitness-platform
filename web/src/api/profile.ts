import api from '@/lib/api';
import type {
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
  maxClients: number;
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
