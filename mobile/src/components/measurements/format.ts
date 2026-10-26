import type { TFunction } from 'i18next';

import type { MetricUnit, Range } from './metrics';

const MINUS = '−';
const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (time: number): number => {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

/** Whole calendar days from `time` to `now` (0 = same day). */
function daysBetween(time: number, now: number): number {
  return Math.round((startOfDay(now) - startOfDay(time)) / DAY_MS);
}

function formatNumber(language: string, value: number): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value);
}

/** "72.4 kg", "79 cm" or "26 %". */
export function metricValueLabel(
  t: TFunction,
  language: string,
  unit: MetricUnit,
  value: number,
): string {
  return t(`measurements.units.${unit}`, { value: formatNumber(language, value) });
}

/** "Last 72.4 kg" hint under a sheet field. */
export function lastHintLabel(
  t: TFunction,
  language: string,
  unit: MetricUnit,
  value: number | undefined,
): string {
  return value === undefined
    ? t('measurements.sheet.neverMeasured')
    : t('measurements.sheet.last', { value: metricValueLabel(t, language, unit, value) });
}

/** "−0.6 this month"; "no change" when the delta rounds to zero. */
export function trendLabel(t: TFunction, language: string, range: Range, change: number): string {
  const rounded = Math.round(change * 10) / 10;
  if (rounded === 0) return t('measurements.trend.noChange');
  const delta = `${rounded < 0 ? MINUS : '+'}${formatNumber(language, Math.abs(rounded))}`;
  return t(`measurements.trend.${range}`, { delta });
}

/** True when the change is a decrease worth the "good" colour. */
export function isDecrease(change: number): boolean {
  return Math.round(change * 10) / 10 < 0;
}

/** "Last updated today", "... yesterday" or "... 3 days ago". */
export function updatedLabel(t: TFunction, lastAt: number, now: number): string {
  const days = Math.max(0, daysBetween(lastAt, now));
  if (days === 0) return t('measurements.updatedToday');
  if (days === 1) return t('measurements.updatedYesterday');
  return t('measurements.updatedDaysAgo', { count: days });
}

/** "Today, 07:40", "Yesterday, 18:05" or "12 Oct, 07:40". */
export function measuredAtLabel(t: TFunction, language: string, at: Date, now: number): string {
  const time = new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }).format(at);
  const days = daysBetween(at.getTime(), now);
  const day =
    days === 0
      ? t('measurements.sheet.today')
      : days === 1
        ? t('measurements.sheet.yesterday')
        : new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(at);
  return `${day}, ${time}`;
}

/** First names joined for the "Shared with" line: "A", "A and B", "A, B and C". */
export function joinNames(t: TFunction, names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  const head = names.slice(0, -1).join(', ');
  return `${head} ${t('measurements.shared.and')} ${names[names.length - 1]}`;
}
