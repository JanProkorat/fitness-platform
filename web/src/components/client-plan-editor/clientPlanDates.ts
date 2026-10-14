import { nextMondayIso } from '@/components/client-detail/nutrition/nutritionPlanView';
import { DAYS_PER_WEEK } from '@/components/plan-editor/plan-editor-types';

const MONDAY_COUNT = 12;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A local calendar date as `YYYY-MM-DD`. */
function toIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The Mondays a plan may start on: this Monday when today is one, then the following weeks. */
export function upcomingMondays(now: Date = new Date(), count: number = MONDAY_COUNT): string[] {
  const first = now.getDay() === 1 ? toIso(now) : nextMondayIso(now);
  const [year, month, day] = first.split('-').map(Number);
  return Array.from({ length: count }, (_, index) => toIso(new Date(year, month - 1, day + index * DAYS_PER_WEEK)));
}

/** Formats a `YYYY-MM-DD` calendar date as "Mon 6 Oct" without shifting it through a time zone. */
export function formatCalendarDate(iso: string, locale: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(Date.UTC(year, month - 1, day));
}

/** Last day of the plan: the start plus whole weeks, minus one day. */
export function planEndDate(startDate: string, weeks: number): string {
  const [year, month, day] = startDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) + (weeks * DAYS_PER_WEEK - 1) * DAY_MS).toISOString().slice(0, 10);
}

/** True once the stored start date is before today: the server no longer accepts a change. */
export function startHasArrived(savedStartDate: string | undefined, now: Date = new Date()): boolean {
  return savedStartDate !== undefined && savedStartDate < toIso(now);
}
