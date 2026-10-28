import type { PlanDay } from '@/api/generated';
import { addDays } from '@/components/nutrition/plan/model';
import type { WeekDay } from '@/components/nutrition/plan/model';

/** Monday of the week containing an ISO date. */
export function mondayOf(iso: string): string {
  const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return addDays(iso, -((weekday + 6) % 7));
}

/** The seven days of the current plan week, Monday first, each with its plan day when the plan has one. */
export function currentWeekDays(weekStart: string, planDays: PlanDay[] | undefined): WeekDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const dayOfWeek = index + 1;
    return {
      date: addDays(weekStart, index),
      dayOfWeek,
      day: (planDays ?? []).find((candidate) => candidate.dayOfWeek === dayOfWeek),
    };
  });
}

/** What a day's meal row may do: logging and photos are for today only. */
export type DayPhase = 'past' | 'today' | 'future';

export const dayPhase = (date: string, today: string): DayPhase =>
  date < today ? 'past' : date > today ? 'future' : 'today';
