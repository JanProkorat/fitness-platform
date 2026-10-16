import axios from 'axios';

import type { RefreshTokenRequest, RefreshTokenResponse } from '@/api/generated';
import { API_BASE_URL } from '@/lib/config';
import { useAuthStore } from '@/stores/auth';

let inFlight: Promise<string> | null = null;

function isSessionRejection(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === 400 || status === 401;
}

/**
 * Single-flight token refresh shared by the 401 interceptor and session restore.
 * Concurrent callers await the same /auth/refresh request. The call uses plain
 * axios, not the shared instance, so it never re-enters the 401 interceptor.
 * A 400/401 answer ends the session; any other failure propagates and keeps it.
 */
export function executeRefresh(): Promise<string> {
  if (inFlight) return inFlight;

  inFlight = (async (): Promise<string> => {
    const { refreshToken, sessionGeneration } = useAuthStore.getState();
    if (!refreshToken) {
      throw new Error('no_refresh_token');
    }

    const body: RefreshTokenRequest = { refreshToken };
    try {
      const { data } = await axios.post<RefreshTokenResponse>(`${API_BASE_URL}/auth/refresh`, body);
      if (!data.accessToken || !data.refreshToken) {
        throw new Error('invalid_refresh_response');
      }
      const applied = await useAuthStore
        .getState()
        .applyRefreshedTokens(sessionGeneration, data.accessToken, data.refreshToken);
      if (!applied) {
        throw new Error('stale_session');
      }
      return data.accessToken;
    } catch (error) {
      // A rejection that arrives after the session changed must not end the new session.
      if (isSessionRejection(error) && useAuthStore.getState().sessionGeneration === sessionGeneration) {
        await useAuthStore.getState().logout();
      }
      throw error;
    }
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}
