import { getErrorCode, getRfc7807ErrorCode } from '@/lib/api-errors';

const SUBSCRIPTION_REQUIRED = 'SUBSCRIPTION_REQUIRED';
const CLIENT_LIMIT_REACHED = 'CLIENT_LIMIT_REACHED';

function hasCode(error: unknown, code: string): boolean {
  return getRfc7807ErrorCode(error) === code || getErrorCode(error) === code;
}

/** 403 SUBSCRIPTION_REQUIRED: the coach's plan does not include the feature. */
export function isSubscriptionRequired(error: unknown): boolean {
  return hasCode(error, SUBSCRIPTION_REQUIRED);
}

/** 403 CLIENT_LIMIT_REACHED: the plan's active-client cap is full. */
export function isClientLimitReached(error: unknown): boolean {
  return hasCode(error, CLIENT_LIMIT_REACHED);
}
