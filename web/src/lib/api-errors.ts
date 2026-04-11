import { AxiosError } from 'axios';
import i18n from '@/i18n';
import { useToastStore } from '@/stores/toast';

interface ProblemDetailsError {
  name: string;
  reason: string;
  code?: string;
}

interface ProblemDetails {
  errors?: ProblemDetailsError[];
}

/**
 * Extracts the first error code from a ProblemDetails API response.
 *
 * FastEndpoints returns errors as { name, reason, code } where:
 *   - `reason` contains the error code string (e.g. "START_DATE_REQUIRED")
 *   - `code`   contains the human-readable message
 */
export function getErrorCode(error: unknown): string | null {
  const axiosError = error as AxiosError<ProblemDetails>;
  const errors = axiosError?.response?.data?.errors;
  if (errors?.length) {
    return errors[0].reason ?? null;
  }
  return null;
}

/**
 * Returns a translated error message for an API error.
 * Tries error code translation first, falls back to the provided fallback key.
 */
export function getApiErrorMessage(error: unknown, fallbackKey: string): string {
  const code = getErrorCode(error);
  if (code) {
    const translated = i18n.t(`apiErrors.${code}`, { defaultValue: '' });
    if (translated) return translated;
  }
  return i18n.t(fallbackKey);
}

/**
 * Shows a toast with a translated API error message.
 */
export function showApiError(error: unknown, fallbackKey: string) {
  const message = getApiErrorMessage(error, fallbackKey);
  useToastStore.getState().addToast(message, 'error');
}

/**
 * Shows an error toast with a translated message.
 */
export function showError(messageKey: string) {
  useToastStore.getState().addToast(i18n.t(messageKey), 'error');
}

/**
 * Shows a success toast.
 */
export function showSuccess(messageKey: string) {
  useToastStore.getState().addToast(i18n.t(messageKey), 'success');
}
