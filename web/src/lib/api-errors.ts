import { AxiosError } from 'axios';
import i18n from '@/i18n';

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
 *   - `reason` contains the human-readable message (FastEndpoints
 *     serializes `ValidationFailure.ErrorMessage` here)
 *   - `code`   contains the machine-readable error code (FastEndpoints
 *     serializes `ValidationFailure.ErrorCode` here — see
 *     backend `Domain/Extensions/EndpointErrorExtensions.cs`, which
 *     constructs `new ValidationFailure("", message) { ErrorCode = errorCode }`)
 *
 * This mapping was previously documented backwards here (reason/code
 * swapped) — that bug meant every lookup fed the human message into the
 * `apiErrors.<code>` translation table, always missed, and silently fell
 * back to the caller's generic message. Read `code` first; `reason` is
 * kept only as a fallback for a shape this function hasn't been verified
 * against everywhere in the app. Do not swap this back — see #1055.
 *
 * NOTE: Non-FastEndpoints RFC 7807 errors (e.g. 409 session_locked) put the
 * code in `response.data.errorCode` (camelCase), not in `errors[0].code`.
 * Use `getRfc7807ErrorCode()` to read those.
 */
export function getErrorCode(error: unknown): string | null {
  const axiosError = error as AxiosError<ProblemDetails>;
  const errors = axiosError?.response?.data?.errors;
  if (errors?.length) {
    return errors[0].code ?? errors[0].reason ?? null;
  }
  return null;
}

/**
 * Extracts the `errorCode` from an RFC 7807 ProblemDetails Extensions field.
 *
 * Used for endpoints that set `errorCode` at the top level of the problem JSON
 * (e.g. 409 session_locked from UpdateTrainingPlan, UnlockTrainingSession).
 * FastEndpoints validation errors use `errors[0].code` instead — use
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
 *   1. FastEndpoints `errors[0].code` (e.g. validation errors)
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

// Toast-dispatch wrappers (showApiError / showError / showSuccess) were
// removed with the UI strip (feature/ui-redesign) — they only bridged to the
// now-deleted `stores/toast.ts`. Re-add them once the new design system's
// notification component lands; callers should use `getApiErrorMessage()` /
// `getErrorCode()` above to get the translated message in the meantime.
