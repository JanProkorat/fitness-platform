import type { LoginResponse } from '@/api/client';
import api from '@/lib/api';

/**
 * POST /auth/social/nonce
 * Requests a single-use, server-issued nonce from the backend.
 * The raw nonce must be passed to the IdP sign-in (Apple/Google) and then
 * sent back in the login body — the backend verifies it was not replayed.
 * TTL is 10 minutes; the nonce is consumed on first use.
 *
 * @returns The raw nonce string.
 */
export async function requestSocialNonce(): Promise<string> {
  const { data } = await api.post<{ nonce: string }>('/auth/social/nonce');
  return data.nonce;
}

/**
 * POST /auth/social/google
 * Sends a Google ID token JWT and the raw nonce to the backend, which verifies
 * the ID token via GoogleJsonWebSignature.ValidateAsync (checking the nonce
 * claim matches) and returns platform JWT tokens.
 *
 * @param idToken - The credential JWT from @react-oauth/google's GoogleLogin
 *                  onSuccess callback (credentialResponse.credential).
 *                  This is an ID token, NOT an OAuth access token.
 *                  Note: do NOT pass an OAuth access token — the backend will reject it.
 * @param nonce   - The raw nonce previously obtained via requestSocialNonce().
 *                  Google embeds the raw nonce into the id_token nonce claim;
 *                  the backend compares it directly.
 */
export async function googleSocialLogin(idToken: string, nonce: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/social/google', { idToken, nonce });
  return data;
}

/**
 * POST /auth/social/apple
 * Sends Apple identity token (and optional first-auth fields) plus the raw nonce
 * to the backend, which verifies the JWT against Apple's JWKS and returns
 * platform JWT tokens. Apple embeds SHA-256(rawNonce) in the id_token nonce
 * claim; the web client passes the raw nonce and the backend hashes it to compare.
 *
 * @param payload.identityToken  - Apple identity token JWT from signInWithApple().
 * @param payload.authorizationCode - Authorization code from Apple (forwarded
 *   for forward-compat; backend ignores it today — no .p8 exchange is done).
 * @param payload.firstName - Present only on first Apple authorization; absent
 *   on re-auth. Backend persists it on new account provision only.
 * @param payload.lastName  - Same as firstName.
 * @param payload.nonce     - The raw nonce previously obtained via requestSocialNonce().
 */
export async function appleSocialLogin(payload: {
  identityToken: string;
  authorizationCode?: string;
  firstName?: string;
  lastName?: string;
  nonce: string;
}): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/social/apple', payload);
  return data;
}
