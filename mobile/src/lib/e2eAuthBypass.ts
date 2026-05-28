/**
 * __DEV__-only utility for the QA deep-link bypass idempotency guard.
 *
 * Metro Fast Refresh can fire both getInitialURL() and the url event listener
 * in quick succession for the same deep link, causing the same refresh token
 * to be consumed twice. The second attempt hits POST /auth/refresh with an
 * already-rotated token, gets a 400, and the catch block in restoreSession()
 * calls logout() — logging the user out immediately after login.
 *
 * We track a single-slot string (the most-recently-consumed token) rather than
 * a Set because the only duplicate event is the same URL re-delivered by Metro
 * HMR; a single slot is sufficient and avoids unbounded growth across a session.
 *
 * All exports are no-ops in release builds so the module tree-shakes cleanly.
 */

let _lastConsumedToken: string | null = null;

/** Record that a refresh token has been used for the e2e bypass in this session. */
export function markTokenConsumed(token: string): void {
  if (!__DEV__) return;
  _lastConsumedToken = token;
}

/**
 * Returns true if the given token is the most-recently-consumed one.
 * Prevents double-firing the same deep-link URL under Metro Fast Refresh.
 */
export function wasTokenConsumed(token: string): boolean {
  if (!__DEV__) return false;
  return _lastConsumedToken === token;
}

/**
 * Clear the consumed-token slot.
 * Called from logout() so a post-logout deep-link with a fresh token
 * (different value) still reaches restoreSession() correctly.
 */
export function resetConsumedTokens(): void {
  if (!__DEV__) return;
  _lastConsumedToken = null;
}
