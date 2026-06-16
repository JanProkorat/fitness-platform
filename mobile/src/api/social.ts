import api from './client';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  emailConfirmed: boolean;
}

interface AppleSocialLoginArgs {
  identityToken: string;
  authorizationCode?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  nonce: string;
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
 * Note: idToken is the ID token JWT obtained from expo-auth-session's Google provider
 * (expo-auth-session/providers/google with ResponseType.IdToken),
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

/**
 * POST /auth/social/apple (anonymous)
 * Sends an Apple identity token JWT, the raw nonce, and optional name fields
 * to the backend.
 *
 * Nonce contract: pass the RAW nonce from requestSocialNonce() here AND into
 * AppleAuthentication.signInAsync({ nonce: rawNonce }). Apple embeds
 * SHA-256(rawNonce) in the identity token automatically — the backend hashes
 * the raw nonce and compares it against the claim. Do NOT pre-hash client-side.
 *
 * firstName / lastName are only present on the very first authorization for a
 * given device/app pair. Pass whatever Apple returns (null is valid — the
 * backend handles absent name gracefully per #480).
 *
 * Error shapes:
 * - 200 → LoginResponse (tokens ready)
 * - 409 → ProblemDetails with top-level errorCode "social_email_conflict"
 *          (email already registered with password — surface conflict message)
 * - 401 → invalid token or nonce → surface generic login-failed message
 */
export async function appleSocialLogin(
  args: AppleSocialLoginArgs,
): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/social/apple', {
    identityToken: args.identityToken,
    authorizationCode: args.authorizationCode,
    firstName: args.firstName,
    lastName: args.lastName,
    nonce: args.nonce,
  });
  return data;
}
