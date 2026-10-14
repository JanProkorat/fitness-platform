import type { ClientPlanItem } from '@/api/client-plans';
import { PlanPhotoType } from '@/api/generated';
import type { ClientPhotoResponse, MeasurementDto, MonthGroupResponse } from '@/api/generated';

export const RANGE_OPTIONS = ['1m', '3m', '6m', '12m', 'all'] as const;
export type PhotoRange = (typeof RANGE_OPTIONS)[number];
export const DEFAULT_RANGE: PhotoRange = '3m';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Half-width of the window searched for the weigh-in closest to a photo. */
export const WEIGH_IN_WINDOW_DAYS = 14;

const RANGE_MONTHS: Record<Exclude<PhotoRange, 'all'>, number> = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 };

/** Lower bound (UTC date, yyyy-MM-dd) of a range, or undefined for "all". Day precision keeps the query key stable. */
export function rangeFrom(range: PhotoRange, now: Date = new Date()): string | undefined {
  if (range === 'all') {
    return undefined;
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - RANGE_MONTHS[range], now.getUTCDate()));
  return start.toISOString().slice(0, 10);
}

/** Every photo of the grouped response, newest first (the server order). */
export function flattenGroups(groups: MonthGroupResponse[] | undefined): ClientPhotoResponse[] {
  return (groups ?? []).flatMap((group) => group.photos ?? []);
}

export function findPhoto(photos: ClientPhotoResponse[], id: string | null | undefined): ClientPhotoResponse | undefined {
  return id ? photos.find((photo) => photo.id === id) : undefined;
}

/** Month heading from the server's "yyyy-MM" key, formatted in UTC so it matches the grouping. */
export function formatMonthKey(yearMonth: string | undefined, locale: string): string {
  const [year, month] = (yearMonth ?? '').split('-').map(Number);
  if (!year || !month) {
    return yearMonth ?? '';
  }
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

function parse(iso: string | undefined): Date | undefined {
  if (!iso) {
    return undefined;
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** "12 Oct" — the photo's takenAt in UTC, the zone the server groups months in. */
export function formatCardDate(iso: string | undefined, locale: string): string {
  const date = parse(iso);
  return date ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date) : '';
}

/** "12 October 2026". */
export function formatLongDate(iso: string | undefined, locale: string): string {
  const date = parse(iso);
  return date
    ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
    : '';
}

/** "18:42" in the coach's local time. */
export function formatTime(iso: string | undefined, locale: string): string {
  const date = parse(iso);
  return date ? new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date) : '';
}

/** "10 Oct" for a weigh-in (local time, like the measurements elsewhere in the portal). */
export function formatMeasuredDate(iso: string | undefined, locale: string): string {
  const date = parse(iso);
  return date ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(date) : '';
}

/** ISO bounds of the weigh-in search window around a photo date. */
export function weighInWindow(takenAt: string | undefined): { from: string; to: string } | undefined {
  const date = parse(takenAt);
  if (!date) {
    return undefined;
  }
  const span = WEIGH_IN_WINDOW_DAYS * DAY_MS;
  return { from: new Date(date.getTime() - span).toISOString(), to: new Date(date.getTime() + span).toISOString() };
}

/** The measurement with a weight closest in time to the photo, or undefined. */
export function nearestWeighIn(
  measurements: MeasurementDto[] | undefined,
  takenAt: string | undefined,
): MeasurementDto | undefined {
  const target = parse(takenAt)?.getTime();
  if (target === undefined) {
    return undefined;
  }
  let best: MeasurementDto | undefined;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const measurement of measurements ?? []) {
    const at = parse(measurement.measuredAt)?.getTime();
    if (at === undefined || measurement.weightKg == null) {
      continue;
    }
    const gap = Math.abs(at - target);
    if (gap < bestGap) {
      best = measurement;
      bestGap = gap;
    }
  }
  return best;
}

/** Number with at most one decimal in the UI locale; `signed` adds an explicit sign for deltas. */
export function formatDecimal(value: number, locale: string, signed = false): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(value);
}

/** Whole days between two photo dates (always positive). */
export function daysApart(a: string | undefined, b: string | undefined): number | undefined {
  const first = parse(a);
  const second = parse(b);
  if (!first || !second) {
    return undefined;
  }
  return Math.round(Math.abs(first.getTime() - second.getTime()) / DAY_MS);
}

export type PhotoPlanKind = 'nutrition' | 'training';

/** Which plan domains the coach's link grants. */
export interface PlanCapabilities {
  nutrition: boolean;
  training: boolean;
}

export interface PhotoPlanInfo {
  kind: PhotoPlanKind;
  /** Null when the plan was removed (or hidden from this coach by the server). */
  name: string | null;
  planId: string;
  week?: number;
  totalWeeks?: number;
}

/** What the photo says about its plan; undefined when the photo has no plan. */
export function photoPlanInfo(
  photo: ClientPhotoResponse,
  plans: ClientPlanItem[] | undefined,
  capabilities: PlanCapabilities,
): PhotoPlanInfo | undefined {
  if (!photo.planId) {
    return undefined;
  }
  const kind: PhotoPlanKind = photo.planType === PlanPhotoType.Nutrition ? 'nutrition' : 'training';
  // The server hides the name of a plan type the coach may not view; that is not a removed plan.
  if (!photo.planName && !capabilities[kind]) {
    return undefined;
  }
  const info: PhotoPlanInfo = { kind, name: photo.planName ?? null, planId: photo.planId };

  const plan = plans?.find((candidate) => candidate.planId === photo.planId);
  const start = parse(plan?.periodStart);
  const taken = parse(photo.takenAt);
  if (plan && start && taken) {
    const week = Math.floor((taken.getTime() - start.getTime()) / (7 * DAY_MS)) + 1;
    const total = plan.weekCount ?? undefined;
    if (week >= 1 && (total === undefined || week <= total)) {
      info.week = week;
      info.totalWeeks = total;
    }
  }
  return info;
}
