const DEV_API_BASE_URL = 'https://localhost:5001';

function resolveApiBaseUrl(): string {
  // Must be a static property access so Expo inlines it at bundle time.
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, '');
  }
  if (__DEV__) {
    return DEV_API_BASE_URL;
  }
  throw new Error('EXPO_PUBLIC_API_BASE_URL is not set; production builds require an explicit API base URL.');
}

export const API_BASE_URL = resolveApiBaseUrl();
