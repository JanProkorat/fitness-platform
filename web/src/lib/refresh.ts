/**
 * Single-flight token refresh helper.
 *
 * Both the Axios 401 interceptor (api.ts) and the session-restore path
 * (stores/auth.ts) share this module so they can never race each other with
 * the same refresh token. Only one /auth/refresh call can be in-flight at a
 * time; concurrent callers wait for the same promise and reuse its result.
 */

import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

/** Resolves to the new access token, or rejects on failure. */
type RefreshResult = string;

let inFlight: Promise<RefreshResult> | null = null;

/**
 * Execute a /auth/refresh call, coalescing concurrent calls into a single
 * in-flight request. When the promise settles the slot is cleared so the
 * next genuine expiry starts a fresh call.
 *
 * Returns the new access token on success.
 * Throws on failure (caller is responsible for logging out when appropriate).
 */
export function executeRefresh(): Promise<RefreshResult> {
  if (inFlight) return inFlight;

  inFlight = (async (): Promise<RefreshResult> => {
    const { refreshToken, setTokens } = useAuthStore.getState();

    if (!refreshToken) {
      throw new Error('no_refresh_token');
    }

    // Use the plain axios instance — NOT the api instance — to avoid
    // triggering the 401 interceptor recursively.
    const { data } = await axios.post('/auth/refresh', { refreshToken });
    setTokens(data.accessToken as string, data.refreshToken as string);
    return data.accessToken as string;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}
