import { executeRefresh } from '@/lib/refresh';
import { useAuthStore } from '@/stores/auth';

/** Refresh when the access token has less than this long left. */
const REFRESH_MARGIN_MS = 30_000;

/** Expiry of a JWT in epoch milliseconds, or null when it cannot be read. */
export function readTokenExpiry(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const claims: unknown = JSON.parse(json);
    if (typeof claims === 'object' && claims !== null && 'exp' in claims) {
      const { exp } = claims as { exp: unknown };
      return typeof exp === 'number' ? exp * 1000 : null;
    }
  } catch {
    // Not a readable token: treat it as expiring so it gets refreshed.
  }
  return null;
}

/**
 * Current access token for a hub connection attempt, refreshed first when it is about to expire.
 * Returns an empty string once the session has ended, and throws when a refresh fails for
 * another reason so the attempt fails instead of sending a dead token.
 */
export async function getHubAccessToken(): Promise<string> {
  const { accessToken, isAuthenticated } = useAuthStore.getState();
  if (!isAuthenticated || !accessToken) return '';

  const expiry = readTokenExpiry(accessToken);
  if (expiry !== null && expiry - Date.now() > REFRESH_MARGIN_MS) return accessToken;

  try {
    return await executeRefresh();
  } catch (error) {
    // A rejected refresh already ended the session; any other failure is retried by the caller.
    if (!useAuthStore.getState().isAuthenticated) return '';
    throw error;
  }
}
