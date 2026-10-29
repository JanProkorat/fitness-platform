import axios from 'axios';

import { ApiException } from '@/api/generated';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

/**
 * Machine-readable code of a ProblemDetails body, read from the first `errors[]` entry.
 * FastEndpoints puts it in `code`; `reason` carries the English message and is a fallback.
 */
export function getProblemCode(error: unknown): string | undefined {
  if (!isRecord(error) || !Array.isArray(error.errors)) return undefined;
  const first: unknown = error.errors[0];
  if (!isRecord(first)) return undefined;
  return nonEmptyString(first.code) ?? nonEmptyString(first.reason);
}

/** HTTP status of whatever the generated client threw, when there was a response. */
export function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiException) return error.status;
  if (axios.isAxiosError(error)) return error.response?.status;
  if (isRecord(error) && typeof error.status === 'number') return error.status;
  return undefined;
}

/** True when the request produced no HTTP response (offline, TLS failure, timeout). */
export function isNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response === undefined;
}

/** True when the API could not be reached or failed server-side; a 4xx answer is not offline. */
export function isOfflineFailure(error: unknown): boolean {
  if (axios.isCancel(error)) return false;
  if (isNetworkError(error)) return true;
  const status = getErrorStatus(error);
  return status !== undefined && status >= 500;
}
