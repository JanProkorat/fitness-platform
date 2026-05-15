import axios from 'axios';
import { getLocales } from 'expo-localization';
import { useAuthStore } from '../stores/auth';

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
