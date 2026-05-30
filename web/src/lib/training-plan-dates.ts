import type { TrainingPlanDetail } from '@/api/training-plan-types';

/**
 * Returns the Monday-00:00 date for a given week of a training plan.
 * Returns `null` when the plan has no `startDate` (week 1 is undated).
 */
export function weekStartDate(plan: TrainingPlanDetail, weekNumber: number): Date | null {
  if (!plan.startDate) return null;
  const start = new Date(plan.startDate);
  if (Number.isNaN(start.getTime())) return null;
  const result = new Date(start);
  result.setDate(start.getDate() + (weekNumber - 1) * 7);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Returns the next-Monday-00:00 date for a given week — i.e. the start of the
 * following week, which is the exclusive upper bound. Returns `null` when the
 * plan has no `startDate`.
 */
export function weekEndDate(plan: TrainingPlanDetail, weekNumber: number): Date | null {
  const start = weekStartDate(plan, weekNumber);
  if (!start) return null;
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return end;
}

/**
 * A week is "finished" when it has been published AND the current date is
 * on or after the start of the following week. Plans without a `startDate`
 * never have a finished week (no date math possible).
 */
export function isWeekFinished(
  plan: TrainingPlanDetail,
  weekNumber: number,
  weekStatus: 'Draft' | 'Published',
  now: Date = new Date(),
): boolean {
  if (weekStatus !== 'Published') return false;
  const end = weekEndDate(plan, weekNumber);
  if (!end) return false;
  return now.getTime() >= end.getTime();
}

/**
 * Returns `true` when the calendar date that corresponds to (`weekNumber`,
 * `dayOfWeek`) inside this plan is strictly before today (start-of-day
 * boundary). Plans without a `startDate` always return `false` — no date
 * math is possible.
 *
 * Uses `dayOfWeek` in the app's `1=Mon..7=Sun` convention so the math
 * matches `weekStartDate` (Monday = day 1).
 */
export function isDayInPast(
  plan: TrainingPlanDetail,
  weekNumber: number,
  dayOfWeek: number,
  now: Date = new Date(),
): boolean {
  const weekStart = weekStartDate(plan, weekNumber);
  if (!weekStart) return false;
  const dayStart = new Date(weekStart);
  dayStart.setDate(weekStart.getDate() + (dayOfWeek - 1));
  dayStart.setHours(0, 0, 0, 0);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  return todayStart.getTime() > dayStart.getTime();
}

/**
 * Returns today's day-of-week in the app's `1=Mon..7=Sun` convention IF today
 * falls inside the given week of the plan, else `null`. Plans without a
 * `startDate` always return `null`.
 */
export function todayWeekdayInPlan(
  plan: TrainingPlanDetail,
  weekNumber: number,
  now: Date = new Date(),
): number | null {
  const start = weekStartDate(plan, weekNumber);
  const end = weekEndDate(plan, weekNumber);
  if (!start || !end) return null;
  const t = now.getTime();
  if (t < start.getTime() || t >= end.getTime()) return null;
  // JS getDay(): 0=Sun..6=Sat → app: 1=Mon..7=Sun
  const jsDay = now.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * Returns the UTC ISO-8601 string for the scheduled calendar date of a
 * specific session within a plan — i.e. the Monday of the given week offset by
 * `(dayOfWeek - 1)` days, at 00:00:00 UTC.
 *
 * This is the value to send as `completedAt` when a trainer retroactively
 * finishes a past session on behalf of the client. Attributing to 00:00 UTC on
 * the session's scheduled day ensures the backend's TrainingCompletion date key
 * resolves to that calendar day regardless of the server's local timezone.
 *
 * Returns `null` when the plan has no `startDate` — the caller should NOT send
 * the request in that case (completedAt would be unresolvable).
 */
export function sessionScheduledDateUtc(
  plan: { startDate?: string | null },
  weekNumber: number,
  dayOfWeek: number,
): string | null {
  if (!plan.startDate) return null;
  const start = new Date(plan.startDate);
  if (Number.isNaN(start.getTime())) return null;
  // Advance to the Monday of the target week (week 1 = startDate itself).
  const dayOffset = (weekNumber - 1) * 7 + (dayOfWeek - 1);
  const utc = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate() + dayOffset,
    0, 0, 0, 0,
  );
  return new Date(utc).toISOString();
}

/**
 * Returns the `weekNumber` of the week that contains `now` based on the plan's
 * `startDate`. Falls back to the first week's number when:
 *   - the plan has no `startDate` (no date math possible),
 *   - the plan has no weeks,
 *   - today is before the plan's start (plan is wholly in the future), or
 *   - today is after the last week's end (plan is wholly in the past).
 */
export function currentWeekNumber(
  plan: TrainingPlanDetail,
  now: Date = new Date(),
): number {
  const fallback = plan.weeks[0]?.weekNumber ?? 1;
  if (!plan.startDate || plan.weeks.length === 0) return fallback;

  const start = new Date(plan.startDate);
  if (Number.isNaN(start.getTime())) return fallback;
  start.setHours(0, 0, 0, 0);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((today.getTime() - start.getTime()) / dayMs);
  if (diffDays < 0) return fallback;

  const weekIdx = Math.floor(diffDays / 7);
  const lastIdx = plan.weeks.length - 1;
  if (weekIdx > lastIdx) return fallback;

  return plan.weeks[weekIdx]?.weekNumber ?? fallback;
}
