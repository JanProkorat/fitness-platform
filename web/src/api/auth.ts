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

/**
 * POST /auth/social/apple
 * Sends Apple identity token (and optional first-auth fields) to the backend,
 * which verifies the JWT against Apple's JWKS and returns platform JWT tokens.
 *
 * @param payload.identityToken  - Apple identity token JWT from signInWithApple().
 * @param payload.authorizationCode - Authorization code from Apple (forwarded
 *   for forward-compat; backend ignores it today — no .p8 exchange is done).
 * @param payload.firstName - Present only on first Apple authorization; absent
 *   on re-auth. Backend persists it on new account provision only.
 * @param payload.lastName  - Same as firstName.
 */
export async function appleSocialLogin(payload: {
  identityToken: string;
  authorizationCode?: string;
  firstName?: string;
  lastName?: string;
}): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/social/apple', payload);
  return data;
}
