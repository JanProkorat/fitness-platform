import axios from 'axios';
import { getLocales } from 'expo-localization';
import { useAuthStore } from '../stores/auth';
import { executeRefresh } from '../lib/refresh';
import { Toast } from '../lib/toast';
import i18n from '../i18n';

// `EXPO_PUBLIC_API_BASE_URL` lets QA dev builds point at the compose-exposed
// API (https://localhost:5001) without rebuilding. Inlined at bundle time by
// Expo, so the override is baked into the .app produced by qa-build-dev-client.sh.
// iOS NSURLSession strips the Authorization header on HTTP→HTTPS redirects, so
// dev MUST hit the HTTPS port directly. Trust the .NET dev cert in the simulator.
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (__DEV__
    ? 'https://localhost:5001'
    : 'https://api.gfplatform.com');

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

// Attach access token, locale, and ensure POST/PUT/PATCH have a JSON body
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const locale = getLocales()[0]?.languageCode ?? 'en';
  config.headers['Accept-Language'] = locale;

  // FastEndpoints requires a JSON body for request binding on POST/PUT/PATCH.
  // When no body is provided, send empty object so route params still bind.
  const method = config.method?.toLowerCase();
  if ((method === 'post' || method === 'put' || method === 'patch') && config.data == null) {
    config.data = {};
  }

  return config;
});

/**
 * Returns true if the error is an Axios 429 response.
 * Extracted so both the top-level 429 guard and the refresh catch share the
 * same logic — the refresh call itself can also be rate-limited.
 */
function isRateLimited(error: unknown): boolean {
  const err = error as import('axios').AxiosError;
  return err?.response?.status === 429;
}

/**
 * Show the rate-limit toast and return a rejected promise.
 * Does NOT call logout() — the user session remains valid.
 */
function rejectWithRateLimit(error: unknown): Promise<never> {
  Toast.show(i18n.t('errors.rateLimit'));
  return Promise.reject(error);
}

// On 401: use the shared single-flight refresh, then retry original request once.
// On 429: surface a toast and reject — do NOT logout.
api.interceptors.response.use(
  (response) => response,
  async (error: import('axios').AxiosError & { config: import('axios').InternalAxiosRequestConfig & { _retry?: boolean } }) => {
    const original = error.config;

    // 429 on the original request — surface toast, keep the user logged in.
    if (isRateLimited(error)) {
      return rejectWithRateLimit(error);
    }

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      const { refreshToken, logout } = useAuthStore.getState();
      if (!refreshToken) {
        logout();
        return Promise.reject(error);
      }

      try {
        // executeRefresh() is single-flight: concurrent 401s await the same promise.
        const newAccessToken = await executeRefresh();
        original.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(original);
      } catch (refreshError) {
        // If the /auth/refresh call itself was rate-limited, show the toast
        // and keep the user logged in — same as a top-level 429.
        if (isRateLimited(refreshError)) {
          return rejectWithRateLimit(refreshError);
        }
        // Any other refresh failure (expired/invalid token, network error) →
        // the session cannot be recovered; logout.
        logout();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
