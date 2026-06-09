import type { LoginResponse } from '@/api/client';
import api from '@/lib/api';

/**
 * POST /auth/social/google
 * Sends a Google ID token JWT to the backend, which verifies it via
 * GoogleJsonWebSignature.ValidateAsync and returns platform JWT tokens.
 *
 * @param idToken - The credential JWT from @react-oauth/google's GoogleLogin
 *                  onSuccess callback (credentialResponse.credential).
 *                  This is an ID token, NOT an OAuth access token.
 *                  Note: do NOT pass an OAuth access token — the backend will reject it.
 */
export async function googleSocialLogin(idToken: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/social/google', { idToken });
  return data;
}
