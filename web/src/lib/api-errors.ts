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
  /** RFC 7807 Extensions field used by non-FastEndpoints error paths. */
  errorCode?: string;
}

/**
 * Extracts the first error code from a ProblemDetails API response.
 *
 * FastEndpoints returns errors as { name, reason, code } where:
 *   - `reason` contains the error code string (e.g. "START_DATE_REQUIRED")
 *   - `code`   contains the human-readable message
 *
 * NOTE: Non-FastEndpoints RFC 7807 errors (e.g. 409 session_locked) put the
 * code in `response.data.errorCode` (camelCase), not in `errors[0].reason`.
 * Use `getRfc7807ErrorCode()` to read those.
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
 * Extracts the `errorCode` from an RFC 7807 ProblemDetails Extensions field.
 *
 * Used for endpoints that set `errorCode` at the top level of the problem JSON
 * (e.g. 409 session_locked from UpdateTrainingPlan, UnlockTrainingSession).
 * FastEndpoints validation errors use `errors[0].reason` instead — use
 * `getErrorCode()` for those.
 */
export function getRfc7807ErrorCode(error: unknown): string | null {
  const axiosError = error instanceof AxiosError ? error : null;
  return (axiosError?.response?.data as ProblemDetails | undefined)?.errorCode ?? null;
}

/**
 * Returns a translated error message for an API error.
 *
 * Checks error codes in order:
 *   1. FastEndpoints `errors[0].reason` (e.g. validation errors)
 *   2. RFC 7807 top-level `errorCode` (e.g. 409 SESSION_ALREADY_COMPLETED
 *      from UnlockTrainingSession, UpdateTrainingPlan)
 *
 * Falls back to the provided fallback key when no code is present or the
 * code has no translation entry.
 */
export function getApiErrorMessage(error: unknown, fallbackKey: string): string {
  const code = getErrorCode(error) ?? getRfc7807ErrorCode(error);
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
