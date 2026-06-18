import axios from 'axios';
import i18n from '@/i18n';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import { executeRefresh } from '@/lib/refresh';

const api = axios.create({
  baseURL: '/',
});

// Axios instance for NSwag-generated client — returns raw text so NSwag's JSON.parse() works
export const rawApi = axios.create({
  baseURL: '/',
  headers: { 'Content-Type': 'application/json' },
  transformResponse: (data) => data,
});

// Attach access token and language to every request
function attachToken(config: import('axios').InternalAxiosRequestConfig) {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['Accept-Language'] = i18n.language;

  // FastEndpoints requires a JSON body for request binding on POST/PUT/PATCH.
  // When no body is provided, send empty object so route params still bind.
  const method = config.method?.toLowerCase();
  if ((method === 'post' || method === 'put' || method === 'patch') && config.data == null) {
    config.data = {};
  }

  return config;
}

// On 401: use the shared single-flight refresh, then retry original request once.
// On 429: surface a toast and reject — do NOT logout.

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
  useToastStore
    .getState()
    .addToast(i18n.t('errors.rateLimitRefresh'), 'error');
  return Promise.reject(error);
}

function handleRefresh(instance: import('axios').AxiosInstance) {
  return async (error: unknown) => {
    const err = error as import('axios').AxiosError & { config: { _retry?: boolean } };
    const original = err.config;

    // 429 on the original request — surface toast, keep the user logged in.
    if (isRateLimited(error)) {
      return rejectWithRateLimit(error);
    }

    if (err.response?.status === 401 && !original._retry) {
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
        return instance(original);
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
  };
}

api.interceptors.request.use(attachToken);
api.interceptors.response.use((r) => r, handleRefresh(api));

rawApi.interceptors.request.use(attachToken);
rawApi.interceptors.response.use((r) => r, handleRefresh(rawApi));

export default api;
