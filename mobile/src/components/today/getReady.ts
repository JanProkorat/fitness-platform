import type { Collaboration } from '@/api/collaborations';
import { ClientPaymentStatus } from '@/api/generated';
import type { MeasurementEntry } from '@/api/measurements';
import type { PaymentCoach } from '@/api/payments';
import type { PhotoMonth } from '@/api/photos';
import type { PendingItems } from '@/api/questionnaires';

import { photoRequestFor } from './coachSteps';
import type { CoveredCollaboration } from './collaborationRoles';
import { hasRunningPlan, hasUnstartedArea } from './todayBlocks';
import type { AreaBlock } from './todayBlocks';

/** One line of the Get ready list. */
export type GetReadyRow =
  | { kind: 'payment'; key: string; done: boolean; due: boolean; overdue: boolean; collaboration: Collaboration }
  | { kind: 'weight'; key: string; done: boolean }
  | { kind: 'photos'; key: string; done: boolean; collaboration: Collaboration };

export type GetReadyInput = {
  blocks: readonly AreaBlock[];
  covering: readonly CoveredCollaboration[];
  paymentsEnabled: boolean;
  /** Undefined while payments are loading or failed: the first payment's own status decides then. */
  payments?: readonly PaymentCoach[] | undefined;
  /** Epoch ms of now; defaults to the current time. */
  now?: number;
  /** Undefined when the request has not answered or failed: no photo row then. */
  pending: PendingItems | undefined;
  /** Undefined when not loaded or failed: the weight row stays open. */
  weights: readonly MeasurementEntry[] | undefined;
  /** Undefined when not loaded or failed: the photo row stays open. */
  photoMonths: readonly PhotoMonth[] | undefined;
};

const collaborationKey = (collaboration: Collaboration): string =>
  collaboration.publicId ?? collaboration.professionalPublicId ?? collaboration.professionalName ?? '';

const startOfLocalDay = (time: number): number => {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

const dayStart = (iso: string | undefined): number | null => {
  const time = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(time) ? null : startOfLocalDay(time);
};

/** The coaches behind the areas that have not started: one entry per coach, even when one covers both. */
export function unstartedCoaches(
  blocks: readonly AreaBlock[],
  covering: readonly CoveredCollaboration[],
): Collaboration[] {
  const coaches = new Map<string, Collaboration>();
  for (const { role, state } of blocks) {
    let collaboration: Collaboration | undefined;
    if (state.kind === 'building') collaboration = state.collaboration;
    else if (state.kind === 'startsLater') {
      collaboration = covering.find((entry) => entry.roles.includes(role))?.collaboration;
    }
    if (collaboration) coaches.set(collaborationKey(collaboration), collaboration);
  }
  return [...coaches.values()];
}

/** True when a paid, period-bound payment of the coach covers the local day of `now`. */
const periodCovers = (coach: PaymentCoach | undefined, now: number): boolean => {
  const today = startOfLocalDay(now);
  return (coach?.paid ?? []).some((item) => {
    const start = dayStart(item.periodStart);
    const end = dayStart(item.periodEnd);
    return start !== null && end !== null && start <= today && today <= end;
  });
};

type PaymentRow = Extract<GetReadyRow, { kind: 'payment' }>;

/** The payment rows: one per coach behind a not-started area whose first payment still matters. */
export function buildPaymentRows(
  coaches: readonly Collaboration[],
  payments: readonly PaymentCoach[] | undefined,
  now: number,
): PaymentRow[] {
  const rows: PaymentRow[] = [];
  for (const collaboration of coaches) {
    const status = collaboration.firstPayment?.status;
    if (status === undefined || status === ClientPaymentStatus.Waived) continue;
    const coach = payments?.find((entry) => entry.coachId === collaboration.professionalPublicId);
    if (coach?.collaborationEnded) continue;
    if (periodCovers(coach, now)) continue;
    const done = status === ClientPaymentStatus.Paid;
    const overdue = status === ClientPaymentStatus.Overdue;
    const due = status === ClientPaymentStatus.Requested || overdue;
    if (!done && !due && status !== ClientPaymentStatus.Upcoming) continue;
    rows.push({ kind: 'payment', key: `payment-${collaborationKey(collaboration)}`, done, due, overdue, collaboration });
  }
  return rows;
}

/** Ids of the requested payments the Get ready list already shows, so Payment due can skip them. */
export function shownFirstPaymentIds(
  blocks: readonly AreaBlock[],
  covering: readonly CoveredCollaboration[],
  payments: readonly PaymentCoach[] | undefined,
  now: number = Date.now(),
): string[] {
  if (!hasUnstartedArea(blocks)) return [];
  return buildPaymentRows(unstartedCoaches(blocks, covering), payments, now)
    .filter((row) => row.due)
    .map((row) => row.collaboration.firstPayment?.paymentId)
    .filter((id): id is string => Boolean(id));
}

/** The rows that apply, in board order: payments, starting weight, starting photos. */
export function buildGetReadyRows({
  blocks,
  covering,
  paymentsEnabled,
  payments,
  now = Date.now(),
  pending,
  weights,
  photoMonths,
}: GetReadyInput): GetReadyRow[] {
  const coaches = unstartedCoaches(blocks, covering);
  const rows: GetReadyRow[] = [];

  if (paymentsEnabled) {
    rows.push(...buildPaymentRows(coaches, payments, now));
  }

  if (!hasRunningPlan(blocks)) {
    // The earliest collaboration start counts; with no usable date any weight entry does.
    const starts = coaches.map((coach) => dayStart(coach.since)).filter((day): day is number => day !== null);
    const since = starts.length > 0 ? Math.min(...starts) : Number.NEGATIVE_INFINITY;
    const done = (weights ?? []).some(
      (entry) => entry.weightKg !== undefined && Number.isFinite(entry.weightKg) && entry.at >= since,
    );
    rows.push({ kind: 'weight', key: 'weight', done });
  }

  const onlyCollaboration = covering.length === 1;
  for (const collaboration of coaches) {
    const request = photoRequestFor(pending, collaboration, onlyCollaboration);
    if (!request) continue;
    const asked = dayStart(request.createdAt);
    const done =
      asked !== null &&
      (photoMonths ?? []).some((month) =>
        month.photos.some((photo) => {
          const taken = dayStart(photo.takenAt);
          return taken !== null && taken >= asked;
        }),
      );
    rows.push({ kind: 'photos', key: `photos-${collaborationKey(collaboration)}`, done, collaboration });
  }

  return rows;
}
