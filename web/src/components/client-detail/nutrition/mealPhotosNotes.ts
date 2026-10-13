import type { CheckInHistoryWeekDto } from '@/api/generated';
import { toCheckInHistoryStatus, type TrainerCheckInDto } from '@/api/weekly-checkins';
import { mealGroup, type MealGroup } from '@/components/client-detail/nutrition/thisWeek';

const DAYS_PER_WEEK = 7;

/** Local Monday 00:00 of the week `now` falls in, to the millisecond before the next one, as ISO UTC strings. */
export function currentWeekRange(now: Date = new Date()): { from: string; to: string } {
  const daysSinceMonday = (now.getDay() + 6) % DAYS_PER_WEEK;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
  const nextMonday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + DAYS_PER_WEEK);
  return { from: monday.toISOString(), to: new Date(nextMonday.getTime() - 1).toISOString() };
}

/** Meal group of a photo, or undefined when the photo is not tied to a plan meal. */
export function photoMealGroup(mealKind: string | null | undefined): MealGroup | undefined {
  return mealKind ? mealGroup(mealKind) : undefined;
}

/** Short weekday name of a moment, in the viewer's local time zone. */
export function formatLocalWeekday(iso: string | undefined, locale: string): string | undefined {
  if (!iso) {
    return undefined;
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);
}

/** Weekday, day and short month of a moment in local time, for example "Sun 28 Sep". */
export function formatCheckInDate(iso: string | null | undefined, locale: string): string | undefined {
  if (!iso) {
    return undefined;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}

/** Newest week of the history (oldest first) the client answered, or undefined. */
export function latestAnsweredWeek(weeks: CheckInHistoryWeekDto[] | undefined): CheckInHistoryWeekDto | undefined {
  return [...(weeks ?? [])].reverse().find((week) => toCheckInHistoryStatus(week.status) === 'answered');
}

/** The client's answered check-in among a week's rows: Nutrition first, then the newest answer. */
export function pickAnsweredCheckIn(rows: TrainerCheckInDto[], clientUserId: string): TrainerCheckInDto | undefined {
  const answered = rows.filter((row) => row.clientUserId === clientUserId && row.respondedAt != null);
  const respondedAt = (row: TrainerCheckInDto) => new Date(row.respondedAt ?? 0).getTime();
  return answered.sort((a, b) => {
    const professionRank = Number(b.profession === 'Nutrition') - Number(a.profession === 'Nutrition');
    return professionRank || respondedAt(b) - respondedAt(a);
  })[0];
}
