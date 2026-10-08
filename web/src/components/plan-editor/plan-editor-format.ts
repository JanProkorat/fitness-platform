import { MealKind } from '@/api/generated';

export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 7] as const;

export const GRID_CLASS = 'grid grid-cols-[8rem_repeat(7,minmax(0,1fr))] items-center gap-3';

export function formatKcal(value: number, language: string): string {
  return Math.round(value).toLocaleString(language);
}

/** Row label key for a meal kind: both snack kinds read "Snack". */
export function mealKindLabelKey(kind: MealKind): string {
  switch (kind) {
    case MealKind.MorningSnack:
    case MealKind.AfternoonSnack:
      return 'snack';
    case MealKind.PreWorkout:
      return 'preWorkout';
    case MealKind.PostWorkout:
      return 'postWorkout';
    case MealKind.Breakfast:
      return 'breakfast';
    case MealKind.Lunch:
      return 'lunch';
    case MealKind.Dinner:
      return 'dinner';
  }
}
