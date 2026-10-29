import { isoDay } from '@/components/nutrition/plan/model';

const DAY_MS = 24 * 60 * 60 * 1000;

const parseDay = (iso: string): number => {
  const [year, month, day] = iso.split('-').map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
};

/** Whole calendar days from `todayIso` to the plan's start date (both `yyyy-MM-dd`). */
export const daysUntil = (startIso: string, todayIso: string): number =>
  Math.round((parseDay(startIso) - parseDay(todayIso)) / DAY_MS);

export type CalendarParts = {
  /** Upper-case short month in the app language, e.g. "NOV". */
  month: string;
  day: number;
  /** 0 (Sunday) to 6 (Saturday). */
  weekday: number;
};

/** Full weekday name of the start date in the app language, e.g. "Monday". */
export const weekdayName = (language: string, startDate: string | undefined): string =>
  new Intl.DateTimeFormat(language, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(parseDay(isoDay(startDate))),
  );

/** The start date split into what the calendar tile and the title need. */
export function calendarParts(language: string, startDate: string | undefined): CalendarParts {
  const iso = isoDay(startDate);
  const date = new Date(parseDay(iso));
  const month = new Intl.DateTimeFormat(language, { month: 'short', timeZone: 'UTC' })
    .format(date)
    .replace(/\.$/, '')
    .toUpperCase();
  return { month, day: date.getUTCDate(), weekday: date.getUTCDay() };
}
