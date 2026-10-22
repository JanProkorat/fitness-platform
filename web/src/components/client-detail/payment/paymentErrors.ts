import { getErrorCode, getErrorStatus, getRfc7807ErrorCode } from '@/lib/api-errors';

export const PAYMENTS_NOT_ENTITLED = 'PAYMENTS_NOT_ENTITLED';
export const BANK_ACCOUNT_NOT_SET = 'BANK_ACCOUNT_NOT_SET';
export const PAYMENT_ALREADY_PAID = 'PAYMENT_ALREADY_PAID';
export const PAYMENT_ALREADY_WAIVED = 'PAYMENT_ALREADY_WAIVED';
export const PAYMENT_REQUEST_RATE_LIMITED = 'PAYMENT_REQUEST_RATE_LIMITED';
export const PAYMENT_PAID_ON_IN_FUTURE = 'PAYMENT_PAID_ON_IN_FUTURE';
export const CURRENCY_MISMATCH_CODE = 'CURRENCY_MISMATCH';

/** The machine-readable code of a failed call, from either error shape. */
export function paymentErrorCode(error: unknown): string | null {
  return getErrorCode(error) ?? getRfc7807ErrorCode(error);
}

/** True when the subscription does not include payments (403 with its own code). */
export function isNotEntitled(error: unknown): boolean {
  return paymentErrorCode(error) === PAYMENTS_NOT_ENTITLED;
}

/** True for a 429, whatever the body says. */
export function isRateLimited(error: unknown): boolean {
  return getErrorStatus(error) === 429 || paymentErrorCode(error) === PAYMENT_REQUEST_RATE_LIMITED;
}

/** True when the row was settled elsewhere while the dialog was open. */
export function isAlreadySettled(error: unknown): boolean {
  const code = paymentErrorCode(error);
  return code === PAYMENT_ALREADY_PAID || code === PAYMENT_ALREADY_WAIVED;
}
