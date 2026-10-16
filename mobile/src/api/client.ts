import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

import { ApiClient } from '@/api/generated';
import { API_BASE_URL } from '@/lib/config';
import { executeRefresh } from '@/lib/refresh';
import { useAuthStore } from '@/stores/auth';

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  // The generated client parses response bodies itself, so keep them as raw text.
  transformResponse: (data: unknown) => data,
});

http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    if (error.response?.status !== 401 || !original || original._retry) {
      return Promise.reject(error);
    }
    original._retry = true;

    try {
      const accessToken = await executeRefresh();
      original.headers.Authorization = `Bearer ${accessToken}`;
      return http(original);
    } catch {
      // executeRefresh already ended the session on 400/401; other failures keep it.
      return Promise.reject(error);
    }
  },
);

export const api = new ApiClient(API_BASE_URL, http);
