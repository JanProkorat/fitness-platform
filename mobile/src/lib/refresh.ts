/**
 * Single-flight token refresh helper.
 *
 * Both the Axios 401 interceptor (api/client.ts) and the session-restore path
 * (stores/auth.ts) share this module so they can never race each other with
 * the same refresh token. Only one /auth/refresh call can be in-flight at a
 * time; concurrent callers wait for the same promise and reuse its result.
 */

import axios from 'axios';
import { useAuthStore } from '../stores/auth';

// Mirror the same base-URL resolution as client.ts so the refresh call hits
// the same host. EXPO_PUBLIC_API_BASE_URL is inlined at bundle time.
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (__DEV__
    ? 'https://localhost:5001'
    : 'https://api.gfplatform.com');

/** Resolves to the new access token, or rejects on failure. */
type RefreshResult = string;

let inFlight: Promise<RefreshResult> | null = null;

/**
 * Execute a /auth/refresh call, coalescing concurrent calls into a single
 * in-flight request. When the promise settles the slot is cleared so the
 * next genuine expiry starts a fresh call.
 *
 * Uses a plain axios.post — NOT the shared api instance — to avoid
 * recursively triggering the 401 interceptor and to keep the import graph
 * acyclic (api/client.ts imports this module; this module must not import
 * api/client.ts).
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

    // Plain axios — not the api instance — to avoid interceptor recursion.
    const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
    setTokens(data.accessToken as string, data.refreshToken as string);
    return data.accessToken as string;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}
