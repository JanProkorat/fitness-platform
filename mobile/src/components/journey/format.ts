import type { TFunction } from 'i18next';

import type { PlanKind } from '@/api/plans';

const MINUS = '−';

/** Placeholder shown wherever a value is missing. */
export const EMPTY_VALUE = '—';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export type Unit = 'kg' | 'cm';

const isNumber = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value);

/** "72.4 kg" or "80 cm". */
export function valueLabel(t: TFunction, language: string, value: number, unit: Unit): string {
  const formatted = new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value);
  return t(`journey.units.${unit}`, { value: formatted });
}

/** Signed change such as "−3.7 kg" with a true minus sign; a dash when either end is missing. */
export function changeLabel(
  t: TFunction,
  language: string,
  from: number | undefined,
  to: number | undefined,
  unit: Unit,
): string {
  if (!isNumber(from) || !isNumber(to)) return EMPTY_VALUE;
  const rounded = Math.round((to - from) * 10) / 10;
  if (rounded === 0) return valueLabel(t, language, 0, unit);
  return `${rounded < 0 ? MINUS : '+'}${valueLabel(t, language, Math.abs(rounded), unit)}`;
}

/** "76.1 → 72.4 kg"; a dash when either end is missing. */
export function fromToLabel(
  t: TFunction,
  language: string,
  from: number | undefined,
  to: number | undefined,
  unit: Unit,
): string {
  if (!isNumber(from) || !isNumber(to)) return EMPTY_VALUE;
  const plain = (value: number) =>
    new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value);
  return t('journey.fromTo', { from: plain(from), to: valueLabel(t, language, to, unit) });
}

/** "89 %" for a 0-100 share; a dash when there is none. */
export function percentLabel(t: TFunction, language: string, value: number | undefined): string {
  if (!isNumber(value)) return EMPTY_VALUE;
  return t('journey.units.percent', {
    value: new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(Math.round(value)),
  });
}

export const parseTime = (iso: string | undefined): number | null => {
  const time = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(time) ? null : time;
};

/** Whole weeks a plan runs, counting both end days. */
export function weeksBetween(start: number, end: number): number {
  return Math.max(1, Math.ceil((end - start + DAY_MS) / WEEK_MS));
}

const monthName = (language: string, time: number, style: 'long' | 'short') =>
  new Intl.DateTimeFormat(language, { month: style, timeZone: 'UTC' }).format(new Date(time));

const yearOf = (time: number) => new Date(time).getUTCFullYear();

/** "March – October 2026", with both years when the journey spans two. */
export function journeyRangeLabel(language: string, start: number, end: number): string {
  const format = new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  if (yearOf(start) !== yearOf(end)) return `${format.format(start)} – ${format.format(end)}`;
  return `${monthName(language, start, 'long')} – ${format.format(end)}`;
}

/** "4 Mar – 9 Jun 2026" (day-level range for the plan summary header). */
export function dayRangeLabel(language: string, start: number, end: number): string {
  const day = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const full = new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return yearOf(start) === yearOf(end)
    ? `${day.format(start)} – ${full.format(end)}`
    : `${full.format(start)} – ${full.format(end)}`;
}

/** "4 Mar" for a photo caption. */
export function dayLabel(language: string, time: number): string {
  return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(time);
}

/** "Jul – now" or "Mar – Jun"; years are added when the plan crosses a year boundary. */
export function planPeriodLabel(
  t: TFunction,
  language: string,
  start: number | null,
  end: number | null,
  active: boolean,
): string {
  if (start === null) return '';
  const endLabel = active ? t('journey.now') : end === null ? '' : monthName(language, end, 'short');
  const crossesYear = !active && end !== null && yearOf(start) !== yearOf(end);
  const startLabel = crossesYear
    ? `${monthName(language, start, 'short')} ${yearOf(start)}`
    : monthName(language, start, 'short');
  const closing = crossesYear && end !== null ? `${endLabel} ${yearOf(end)}` : endLabel;
  return closing ? `${startLabel} – ${closing}` : startLabel;
}

export type PlanBand = { kind: PlanKind; from: number; to: number };

type BandSource = {
  type?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  dateCompleted?: string;
};

/** The stretch of time a plan covered: planned end, or the completion date when it ended early. */
export function planWindow(plan: BandSource, now: number, active: boolean): { from: number; to: number } | null {
  const from = parseTime(plan.startDate);
  if (from === null) return null;
  const planned = parseTime(plan.endDate);
  const completed = parseTime(plan.dateCompleted);
  const ends = [active ? now : completed, planned].filter((value): value is number => value !== null);
  if (ends.length === 0) return null;
  const to = Math.min(...ends);
  return to >= from ? { from, to } : null;
}

export type SeriesPoint = { at: number; value: number };

/** Value of a series at `at`, interpolated between neighbours and held at either end. */
export function valueAt(points: readonly SeriesPoint[], at: number): number | null {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return null;
  if (at <= first.at) return first.value;
  if (at >= last.at) return last.value;
  for (let index = 1; index < points.length; index += 1) {
    const next = points[index];
    const previous = points[index - 1];
    if (next && previous && at <= next.at) {
      const span = next.at - previous.at;
      const ratio = span === 0 ? 0 : (at - previous.at) / span;
      return previous.value + (next.value - previous.value) * ratio;
    }
  }
  return last.value;
}

export type Domain = { start: number; end: number };

/** Smallest range covering `times`, at least a day wide so scales never divide by zero. */
export function domainOf(times: readonly number[]): Domain | null {
  if (times.length === 0) return null;
  const start = Math.min(...times);
  const end = Math.max(...times);
  return { start, end: Math.max(end, start + DAY_MS) };
}

/** Month starts inside the domain, thinned so at most `maxLabels` remain. */
export function monthTicks(
  domain: Domain,
  language: string,
  maxLabels: number,
): { at: number; label: string }[] {
  const ticks: number[] = [];
  const first = new Date(domain.start);
  let cursor = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1);
  if (cursor < domain.start) cursor = Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1);
  while (cursor <= domain.end) {
    ticks.push(cursor);
    const date = new Date(cursor);
    cursor = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  }
  const step = Math.max(1, Math.ceil(ticks.length / maxLabels));
  return ticks
    .filter((_, index) => index % step === 0)
    .map((at) => ({ at, label: monthName(language, at, 'short') }));
}

/** Padded min and max so the line does not touch the top and bottom of the plot. */
export function valueRange(values: readonly number[]): { min: number; max: number } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = max === min ? 1 : (max - min) * 0.12;
  return { min: min - pad, max: max + pad };
}
