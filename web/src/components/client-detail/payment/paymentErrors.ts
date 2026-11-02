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

export const PACKAGE_ARCHIVED_CODE = 'PACKAGE_ARCHIVED';
export const DISCOUNT_ARCHIVED_CODE = 'DISCOUNT_ARCHIVED';
export const DISCOUNT_PACKAGE_INVALID_CODE = 'DISCOUNT_PACKAGE_INVALID';
export const INVITE_DISCOUNT_NEEDS_PACKAGE_CODE = 'INVITE_DISCOUNT_NEEDS_PACKAGE';

/** What the invite drawer does about a failed create that carried a package or discount. */
export interface InvitePaymentFailure {
  /** i18n key of the message to show. */
  messageKey: string;
  /** Which picker lists are stale and should be refetched. */
  refetch: 'packages' | 'discounts' | 'both' | 'none';
  /** The coach lost payments: hide the section. */
  notEntitled?: boolean;
}

const INVITE_ERROR_KEYS = 'clients.addClientDrawer.payment.errors';
const OFFER_ERROR_KEYS = 'offer.errors';

function paymentFailure(error: unknown, keyPrefix: string): InvitePaymentFailure | null {
  const code = paymentErrorCode(error);
  switch (code) {
    case PAYMENTS_NOT_ENTITLED:
      return { messageKey: `${keyPrefix}.notEntitled`, refetch: 'both', notEntitled: true };
    case PACKAGE_ARCHIVED_CODE:
      return { messageKey: `${keyPrefix}.packageArchived`, refetch: 'both' };
    case DISCOUNT_ARCHIVED_CODE:
      return { messageKey: `${keyPrefix}.discountArchived`, refetch: 'discounts' };
    case DISCOUNT_PACKAGE_INVALID_CODE:
    case INVITE_DISCOUNT_NEEDS_PACKAGE_CODE:
      return { messageKey: `${keyPrefix}.discountInvalid`, refetch: 'discounts' };
    case CURRENCY_MISMATCH_CODE:
      return { messageKey: `${keyPrefix}.currencyMismatch`, refetch: 'none' };
    default:
      // A bare 404 (no code) means the package or discount was deleted or is not the coach's.
      return code === null && getErrorStatus(error) === 404
        ? { messageKey: `${keyPrefix}.unavailable`, refetch: 'both' }
        : null;
  }
}

/** Maps a failed invite create to its payment-specific handling, or null when the failure is not about payments. */
export function invitePaymentFailure(error: unknown): InvitePaymentFailure | null {
  return paymentFailure(error, INVITE_ERROR_KEYS);
}

/** The same handling for a failed accept or propose of a client request, with copy that fits the review drawer. */
export function offerPaymentFailure(error: unknown): InvitePaymentFailure | null {
  return paymentFailure(error, OFFER_ERROR_KEYS);
}

/** True when the request was already answered, withdrawn or cancelled elsewhere (409). */
export function isRequestStateConflict(error: unknown): boolean {
  return paymentErrorCode(error) === 'CLIENT_REQUEST_INVALID_STATE';
}
