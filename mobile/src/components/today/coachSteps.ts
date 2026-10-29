import type { TFunction } from 'i18next';

import type { Collaboration } from '@/api/collaborations';
import type { Conversation } from '@/api/conversations';
import { ClientPaymentStatus } from '@/api/generated';
import type { CollaborationFirstPaymentDto } from '@/api/generated';
import type { PendingDiaryRequest, PendingItems } from '@/api/questionnaires';
import { formatMoney } from '@/components/payments/format';

import type { StepState } from './TimelineStep';

/** One row of a coach's setup steps (the Today progress card and the upcoming nutrition plan). */
export type Step = {
  key: string;
  state: StepState;
  title: string;
  hint?: string;
  currentColor?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionTone?: 'primary' | 'secondary';
};

const normalize = (name: string | undefined): string => (name ?? '').trim().toLowerCase();

/** The chat with this coach, matched by participant id first and display name second. */
export function findConversation(
  conversations: readonly Conversation[] | undefined,
  collaboration: Collaboration,
): Conversation | undefined {
  const live = (conversations ?? []).filter((conversation) => !conversation.isFormer);
  const byId = live.find(
    (conversation) =>
      conversation.participant?.id !== undefined &&
      conversation.participant.id === collaboration.professionalPublicId,
  );
  if (byId) return byId;
  const name = normalize(collaboration.professionalName);
  return name === '' ? undefined : live.find((c) => normalize(c.participant?.name) === name);
}

const createdTime = (request: PendingDiaryRequest): number => {
  const time = request.createdAt ? Date.parse(request.createdAt) : Number.NaN;
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
};

/** The oldest pending photo request from this coach; an unmatched one belongs to the only coach. */
export function photoRequestFor(
  pending: PendingItems | undefined,
  collaboration: Collaboration,
  onlyCollaboration: boolean,
): PendingDiaryRequest | undefined {
  const requests = pending?.diaryRequests ?? [];
  const name = normalize(collaboration.professionalName);
  const named = requests.filter((request) => normalize(request.professionalName) === name);
  const candidates = named.length > 0 ? named : onlyCollaboration ? requests : [];
  return candidates.reduce<PendingDiaryRequest | undefined>(
    (oldest, request) => (oldest === undefined || createdTime(request) < createdTime(oldest) ? request : oldest),
    undefined,
  );
}

export const hasPhotoRequest = (
  pending: PendingItems | undefined,
  collaboration: Collaboration,
  onlyCollaboration: boolean,
): boolean => photoRequestFor(pending, collaboration, onlyCollaboration) !== undefined;

/** First payment of the agreed terms: Upcoming only informs, Requested and Overdue ask the client to pay. */
export function paymentPhase(firstPayment: CollaborationFirstPaymentDto | undefined): {
  upcoming: boolean;
  due: boolean;
} {
  const status = firstPayment?.status;
  return {
    upcoming: status === ClientPaymentStatus.Upcoming,
    due: status === ClientPaymentStatus.Requested || status === ClientPaymentStatus.Overdue,
  };
}

type PaymentStepOptions = {
  t: TFunction;
  language: string;
  firstPayment: CollaborationFirstPaymentDto;
  /** First name of the coach, shown in the hint. */
  name: string;
  onShowQr: () => void;
  /** Filled by default; outlined when another step holds the main call to action. */
  tone?: 'primary' | 'secondary';
};

/** The open "pay the first month" step; the QR action exists only while a payment is due. */
export function firstPaymentStep({
  t,
  language,
  firstPayment,
  name,
  onShowQr,
  tone = 'primary',
}: PaymentStepOptions): Step {
  const { upcoming, due } = paymentPhase(firstPayment);
  const details = [firstPayment.packageName?.trim(), formatMoney(firstPayment.amount, firstPayment.currency, language)]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
  let hintKey = 'today.progress.firstPayment.requestedHint';
  if (upcoming) hintKey = 'today.progress.firstPayment.upcomingHint';
  else if (firstPayment.status === ClientPaymentStatus.Overdue) hintKey = 'today.progress.firstPayment.overdueHint';
  return {
    key: 'first-payment',
    state: 'open',
    title: t('today.progress.firstPayment.title'),
    hint: t(hintKey, { details, name }),
    // The QR code lives on the Payments screen; the step only leads there.
    actionLabel: due ? t('today.progress.firstPayment.showQr') : undefined,
    onAction: due ? onShowQr : undefined,
    actionTone: tone,
  };
}

/** The open "starting photos" step. */
export function photoStep(t: TFunction, name: string, onAdd: () => void): Step {
  return {
    key: 'photos',
    state: 'open',
    title: t('today.progress.photos'),
    hint: t('today.progress.photosHint', { name }),
    actionLabel: t('today.progress.photosAdd'),
    onAction: onAdd,
  };
}
