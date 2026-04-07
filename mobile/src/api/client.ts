import axios from 'axios';
import { getLocales } from 'expo-localization';
import { useAuthStore } from '../stores/auth';

const API_BASE_URL = __DEV__
  ? 'http://localhost:5000'  // iOS simulator – use HTTP port (5001 is HTTPS)
  : 'https://api.gfplatform.com'; // production

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

// On 401: attempt token refresh, then retry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const { refreshToken, setTokens, logout } = useAuthStore.getState();
      if (!refreshToken) {
        logout();
        return Promise.reject(error);
      }
      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });
        setTokens(data.accessToken, data.refreshToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        logout();
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
