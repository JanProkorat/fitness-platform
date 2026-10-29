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

/** First day of a week: the plan's start plus whole weeks (`weekNumber` is 1-based). */
function weekFirstDay(startDate: string, weekNumber: number): string {
  const [year, month, day] = startDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) + (weekNumber - 1) * DAYS_PER_WEEK * DAY_MS).toISOString().slice(0, 10);
}

/**
 * The week (0-based) and weekday (1 = Monday) a calendar date falls on in a plan starting on `startDate`,
 * or null when the date is before the plan or not a valid `YYYY-MM-DD`.
 */
export function planPositionOfDate(startDate: string, date: string): { weekIndex: number; dayOfWeek: number } | null {
  const start = startDate.slice(0, 10).split('-').map(Number);
  const target = date.slice(0, 10).split('-').map(Number);
  if (start.length !== 3 || target.length !== 3 || [...start, ...target].some(Number.isNaN)) {
    return null;
  }
  const offset = Math.round((Date.UTC(target[0], target[1] - 1, target[2]) - Date.UTC(start[0], start[1] - 1, start[2])) / DAY_MS);
  if (offset < 0) {
    return null;
  }
  return { weekIndex: Math.floor(offset / DAYS_PER_WEEK), dayOfWeek: (offset % DAYS_PER_WEEK) + 1 };
}

/**
 * True once a published week's first day is today or earlier, which is when the server stops deleting the
 * plan. A plan without a start date has not started.
 */
export function publishedWeekHasStarted(
  startDate: string | undefined,
  weeks: readonly { weekNumber: number; published: boolean }[],
  now: Date = new Date(),
): boolean {
  if (startDate === undefined) {
    return false;
  }
  const today = toIso(now);
  return weeks.some((week) => week.published && weekFirstDay(startDate, week.weekNumber) <= today);
}

/** True once the plan's last day is before today; a plan without a start date never ends. */
export function planHasEnded(startDate: string | undefined, weekCount: number, now: Date = new Date()): boolean {
  return startDate !== undefined && weekCount > 0 && planEndDate(startDate, weekCount) < toIso(now);
}
