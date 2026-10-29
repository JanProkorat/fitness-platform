import axios from 'axios';

import { getErrorStatus, getProblemCode, isOfflineFailure } from '@/api/errors';
import { ApiException } from '@/api/generated';
import { getTopLevelErrorCode } from '@/api/nutrition';
import type { DropReason, OutboxKind } from '@/lib/outbox/types';

export const OCCURRED_AT_TOO_OLD = 'OCCURRED_AT_TOO_OLD';
/** Server-side races on the day log are retried this many times before the entry is given up on. */
export const MAX_CONFLICT_RETRIES = 3;

/** Every body the failure may carry: the error itself, the raw text of an ApiException, an axios response. */
function bodiesOf(error: unknown): unknown[] {
  const bodies: unknown[] = [error];
  if (error instanceof ApiException) {
    try {
      bodies.push(JSON.parse(error.response) as unknown);
    } catch {
      // Not JSON; there is no code to read.
    }
  }
  if (axios.isAxiosError(error)) bodies.push(error.response?.data);
  return bodies;
}

/** Machine-readable codes of a failure: `errors[].code` and the top-level `errorCode`. */
export function errorCodes(error: unknown): string[] {
  const codes: string[] = [];
  for (const body of bodiesOf(error)) {
    const problem = getProblemCode(body);
    if (problem) codes.push(problem);
    const topLevel = getTopLevelErrorCode(body) ?? getTopLevelErrorCode({ result: body });
    if (topLevel) codes.push(topLevel);
  }
  return codes;
}

/** Short text kept on the entry as `lastError`. */
export function describeFailure(error: unknown): string {
  const status = getErrorStatus(error);
  const code = errorCodes(error)[0];
  if (status === undefined) return code ?? 'network';
  return code ? `HTTP ${status} ${code}` : `HTTP ${status}`;
}

export type FailureOutcome =
  /** Stop and try again on a later trigger; `backoff` says whether to also wait. */
  | { type: 'retryLater'; wait: 'none' | 'rateLimit' | 'backoff' }
  /** Stop and keep the entry untouched (the session refresh deals with a 401). */
  | { type: 'keep' }
  /** Send the same entry again right away. */
  | { type: 'retryNow' }
  | { type: 'drop'; reason: DropReason };

const isOffPlan = (kind: OutboxKind): boolean => kind === 'offPlanAdded' || kind === 'offPlanRemoved';

/** What the drain does about a failed send. `conflicts` is how many conflicts this entry already had. */
export function classifyFailure(error: unknown, kind: OutboxKind, conflicts: number): FailureOutcome {
  const status = getErrorStatus(error);
  if (status === undefined) {
    // No response: offline. Anything else without a status is unknown, so keep the entry and back off.
    return { type: 'retryLater', wait: isOfflineFailure(error) ? 'none' : 'backoff' };
  }
  if (status >= 500) return { type: 'retryLater', wait: 'backoff' };
  if (status === 429) return { type: 'retryLater', wait: 'rateLimit' };
  if (status === 401) return { type: 'keep' };

  const codes = errorCodes(error);
  if (status === 409 && isOffPlan(kind)) {
    // The day log changed under the write (DAY_LOG_VERSION_CONFLICT); the server marks it as retryable.
    return conflicts >= MAX_CONFLICT_RETRIES ? { type: 'drop', reason: 'conflict' } : { type: 'retryNow' };
  }
  if (status === 400 && codes.includes(OCCURRED_AT_TOO_OLD)) return { type: 'drop', reason: 'tooOld' };
  if (status === 404) return { type: 'drop', reason: 'notFound' };
  return { type: 'drop', reason: 'rejected' };
}
