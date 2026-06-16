import api from './client';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  emailConfirmed: boolean;
}

/**
 * POST /auth/social/nonce (anonymous)
 * Requests a single-use, server-issued nonce for a social sign-in attempt.
 * The raw nonce is passed to the native SDK (Google/Apple) so the IdP can
 * embed it in the returned id_token. The same raw nonce is then sent in the
 * login body so the backend can verify it was not replayed.
 * TTL is 10 minutes; the nonce is consumed on first successful use.
 */
export async function requestSocialNonce(): Promise<string> {
  const { data } = await api.post<{ nonce: string }>('/auth/social/nonce');
  return data.nonce;
}

/**
 * POST /auth/social/google (anonymous)
 * Sends a Google ID token JWT and the raw nonce to the backend.
 * The backend verifies the ID token via GoogleJsonWebSignature.ValidateAsync,
 * checks the nonce claim, and returns platform JWT tokens.
 *
 * Note: idToken is the ID token JWT from @react-native-google-signin/google-signin,
 * NOT an OAuth access token. Google embeds the raw nonce directly in the id_token
 * nonce claim (no hashing, unlike Apple).
 *
 * Error shapes:
 * - 200 → LoginResponse (tokens ready)
 * - 409 → ProblemDetails with top-level errorCode "social_email_conflict"
 *          (email already registered with password — surface conflict message)
 * - 401 → invalid token or nonce → surface generic login-failed message
 */
export async function googleSocialLogin(
  idToken: string,
  nonce: string,
): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/social/google', {
    idToken,
    nonce,
  });
  return data;
}
