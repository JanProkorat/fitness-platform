import { MealKind } from '@/api/generated';

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
