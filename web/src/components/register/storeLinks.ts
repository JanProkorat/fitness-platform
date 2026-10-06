/** A store link is only trusted when it is an absolute http(s) URL. */
export function storeUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

export const APP_STORE_URL = storeUrl(import.meta.env.VITE_APP_STORE_URL);
export const GOOGLE_PLAY_URL = storeUrl(import.meta.env.VITE_GOOGLE_PLAY_URL);

/** True when at least one store listing is not available yet. */
export const SOME_STORE_MISSING = !APP_STORE_URL || !GOOGLE_PLAY_URL;
