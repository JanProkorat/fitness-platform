import type { FullPlanWeek, GetFullPlanResponse, GetWeekMealLogResponse, PlanDay } from '@/api/generated';
import type { NutritionMeal } from '@/api/nutrition';
import type { MealStatus } from '@/components/nutrition/meals/MealStatusIcon';
import { addMacros, EMPTY_MACROS } from '@/components/nutrition/meal/format';
import type { Macros } from '@/components/nutrition/meal/format';
import { mealMacros } from '@/components/nutrition/meals/model';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The `yyyy-MM-dd` part of an API date or date-time. */
export const isoDay = (value: string | undefined): string => (value ?? '').slice(0, 10);

const parseDay = (iso: string): number => {
  const [year, month, day] = iso.split('-').map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
};

const formatDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export const addDays = (iso: string, days: number): string => formatDay(parseDay(iso) + days * DAY_MS);

/** The device's calendar date as `yyyy-MM-dd`; used until the server's client-local today is known. */
export function localToday(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Short day and month of an ISO date in the app language, e.g. "28 Sep". */
export const formatShortDate = (language: string, iso: string): string =>
  new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(parseDay(iso));

/** "28 Sep – 4 Oct". */
export const formatRange = (language: string, startIso: string, endIso: string): string =>
  `${formatShortDate(language, startIso)} – ${formatShortDate(language, endIso)}`;

export const weekdayInitial = (language: string, iso: string): string =>
  new Intl.DateTimeFormat(language, { weekday: 'narrow', timeZone: 'UTC' }).format(parseDay(iso));

export const weekdayName = (language: string, iso: string): string =>
  new Intl.DateTimeFormat(language, { weekday: 'long', day: 'numeric', timeZone: 'UTC' }).format(parseDay(iso));

export const dayOfMonth = (iso: string): number => Number(iso.slice(8, 10));

export type WeekDay = { date: string; dayOfWeek: number; day: PlanDay | undefined };

/** The seven calendar days of a week, Monday first, each with its plan day when the plan has one. */
export function weekDays(week: FullPlanWeek): WeekDay[] {
  const start = isoDay(week.weekStartDate);
  return Array.from({ length: 7 }, (_, index) => {
    const dayOfWeek = index + 1;
    return {
      date: addDays(start, index),
      dayOfWeek,
      day: (week.days ?? []).find((candidate) => candidate.dayOfWeek === dayOfWeek),
    };
  });
}

/** Meals of a plan day in plan order; only meals that carry an id can be logged. */
export const dayMeals = (day: PlanDay | undefined): NutritionMeal[] =>
  [...(day?.meals ?? [])]
    .filter((meal): meal is NutritionMeal => typeof meal.mealId === 'string')
    .sort((first, second) => (first.order ?? 0) - (second.order ?? 0));

export const weekMealCount = (week: FullPlanWeek): number =>
  weekDays(week).reduce((total, { day }) => total + dayMeals(day).length, 0);

export type WeekPhase = 'past' | 'current' | 'future';

export function weekPhase(week: FullPlanWeek, today: string): WeekPhase {
  const start = isoDay(week.weekStartDate);
  const end = isoDay(week.weekEndDate) || addDays(start, 6);
  if (end < today) return 'past';
  if (start > today) return 'future';
  return 'current';
}

/** The plan is over: nothing is left to do, so an unlogged meal counts as missed. */
export const isPlanFinished = (plan: GetFullPlanResponse | undefined): boolean =>
  plan?.status === 'Completed' || plan?.status === 'Archived';

/** Meals of a week that are eaten according to the plan's flat eaten-id set. */
export function eatenInWeek(week: FullPlanWeek, eatenIds: ReadonlySet<string>): number {
  return weekDays(week).reduce(
    (total, { day }) => total + dayMeals(day).filter((meal) => eatenIds.has(meal.mealId)).length,
    0,
  );
}

type LogMeal = NonNullable<NonNullable<GetWeekMealLogResponse['days']>[number]['meals']>[number];

/** The log entry of one meal on one date, when the week log has one. */
export function findLoggedMeal(
  log: GetWeekMealLogResponse | undefined,
  date: string,
  mealId: string,
): LogMeal | undefined {
  const day = (log?.days ?? []).find((entry) => isoDay(entry.date) === date);
  return (day?.meals ?? []).find((entry) => entry.mealId === mealId);
}

export const canAddPhotos = (log: GetWeekMealLogResponse | undefined, date: string): boolean =>
  (log?.days ?? []).find((entry) => isoDay(entry.date) === date)?.canAddPhotos === true;

/** Status of a meal on a date. Without a log nothing can be called eaten or missed, so it stays neutral. */
export function mealStatus(options: {
  eaten: boolean;
  logAvailable: boolean;
  date: string;
  today: string;
  planFinished: boolean;
}): MealStatus {
  if (options.eaten) return 'eaten';
  if (!options.logAvailable) return 'pending';
  return options.date < options.today || options.planFinished ? 'missed' : 'pending';
}

/** Total macros of the meals of a day that are eaten. */
export function eatenMacros(meals: NutritionMeal[], isEaten: (mealId: string) => boolean): Macros {
  return meals.filter((meal) => isEaten(meal.mealId)).map(mealMacros).reduce(addMacros, EMPTY_MACROS);
}

/** Calendar end of the plan, from its start date and total week count. */
export function planEndDate(startIso: string, totalWeeks: number): string {
  return addDays(startIso, Math.max(totalWeeks, 1) * 7 - 1);
}
