import { api } from '@/api/client';
import type { ClientPaymentCoachDto, ClientPaymentItemDto } from '@/api/generated';
import { ClientPaymentStatus } from '@/api/generated';

export type PaymentCoach = ClientPaymentCoachDto;
export type PaymentItem = ClientPaymentItemDto;

export const PAYMENTS_QUERY_KEY = ['client', 'payments'] as const;

/** Lowercased type of the in-app notification sent when a coach requests a payment. */
export const PAYMENT_REQUESTED_TYPE = 'paymentrequested';

/** What the client owes and has paid, one entry per coach. */
export async function fetchPayments(signal?: AbortSignal): Promise<PaymentCoach[]> {
  const response = await api.getClientPaymentsEndpoint(signal);
  return response.coaches ?? [];
}

/** True for the in-app notification type or the push `type` value of a payment request (case-insensitive). */
export function isPaymentRequestedType(type: unknown): boolean {
  return typeof type === 'string' && type.toLowerCase() === PAYMENT_REQUESTED_TYPE;
}

/** True for a requested payment that is past its due date. */
export function isOverdue(item: PaymentItem): boolean {
  return item.status === ClientPaymentStatus.Overdue;
}

/** Requested or overdue payments across all coaches. */
export function countOpenPayments(coaches: readonly PaymentCoach[]): number {
  return coaches.reduce((total, coach) => total + (coach.requested?.length ?? 0), 0);
}
