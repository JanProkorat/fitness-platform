import axios from 'axios';
import i18n from '@/i18n';
import { useAuthStore } from '@/stores/auth';

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

  // Ensure POST/PUT/PATCH without body still send Content-Type for FastEndpoints binding
  const method = config.method?.toLowerCase();
  if ((method === 'post' || method === 'put' || method === 'patch') && config.data == null) {
    config.headers['Content-Type'] = 'application/json';
  }

  return config;
}

// On 401: attempt token refresh, then retry original request once
function handleRefresh(instance: import('axios').AxiosInstance) {
  return async (error: unknown) => {
    const err = error as import('axios').AxiosError & { config: { _retry?: boolean } };
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;

      const { refreshToken, setTokens, logout } = useAuthStore.getState();
      if (!refreshToken) {
        logout();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post('/auth/refresh', {
          refreshToken,
        });
        setTokens(data.accessToken, data.refreshToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
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
