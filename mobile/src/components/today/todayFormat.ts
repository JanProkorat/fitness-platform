import type { TFunction } from 'i18next';

import type { CollaborationCheckInDto, DayOfWeek } from '@/api/generated';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;

/** "since Monday" within the last week, "since 3 Oct" for older links; empty when the date is unusable. */
export function sinceLabel(
  t: TFunction,
  language: string,
  iso: string | undefined,
  now: number = Date.now(),
): string {
  const then = iso ? Date.parse(iso) : Number.NaN;
  if (Number.isNaN(then)) return '';
  const date = new Date(then);
  const days = Math.floor((now - then) / DAY_MS);
  const when =
    days < WEEK_DAYS
      ? date.toLocaleDateString(language, { weekday: 'long' })
      : date.toLocaleDateString(language, { day: 'numeric', month: 'short' });
  return t('today.progress.since', { when });
}

const WEEKDAY_INDEX: Record<DayOfWeek, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/** 7 Jan 2024 was a Sunday; offsetting from it names any weekday without a timezone shift. */
const SUNDAY_REFERENCE = { year: 2024, month: 0, day: 7 };

/** The weekday names of the coach's check-ins in the app language ("Sunday"); empty when none is scheduled. */
export function checkInDaysLabel(
  language: string,
  checkIns: readonly CollaborationCheckInDto[] | undefined,
): string {
  const days = new Set<number>();
  for (const entry of checkIns ?? []) {
    if (entry.dayOfWeek !== undefined) days.add(WEEKDAY_INDEX[entry.dayOfWeek]);
  }
  const formatter = new Intl.DateTimeFormat(language, { weekday: 'long' });
  return [...days]
    .sort((a, b) => a - b)
    .map((index) =>
      formatter.format(new Date(SUNDAY_REFERENCE.year, SUNDAY_REFERENCE.month, SUNDAY_REFERENCE.day + index)),
    )
    .join(', ');
}
