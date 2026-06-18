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
function handleRefresh(instance: import('axios').AxiosInstance) {
  return async (error: unknown) => {
    const err = error as import('axios').AxiosError & { config: { _retry?: boolean } };
    const original = err.config;

    // 429 — rate limited. Surface toast, keep the user logged in.
    if (err.response?.status === 429) {
      useToastStore
        .getState()
        .addToast(i18n.t('errors.rateLimitRefresh'), 'error');
      return Promise.reject(error);
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
      } catch {
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
