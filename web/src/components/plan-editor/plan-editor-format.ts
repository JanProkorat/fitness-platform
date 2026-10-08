import { MealKind } from '@/api/generated';

export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * One grid for the whole week: the label column is as wide as the longest label, the days share the rest.
 * `isolate` keeps the tinted surface (a `-z-10` child) behind the cards but above the page.
 */
export const WEEK_GRID_CLASS = 'relative isolate grid grid-cols-[max-content_repeat(7,minmax(0,1fr))] gap-3';

/** Keeps row labels clear of the tinted surface that pads the day columns by 12px. */
export const GRID_LABEL_CLASS = 'mr-3 self-center text-body font-semibold whitespace-nowrap text-muted-foreground';

/** A row of the week grid, aligned to its columns. */
export const GRID_CLASS = 'grid grid-cols-subgrid col-span-8 items-center';

/** Rows: header and day totals by content, then the meal rows share the free height. */
export function weekGridRows(mealRowCount: number, minRowRem: number): { gridTemplateRows: string } {
  return { gridTemplateRows: `auto auto repeat(${mealRowCount}, minmax(${minRowRem}rem, 1fr))` };
}

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
