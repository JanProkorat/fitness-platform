import { MealKind } from '@/api/generated';

export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * One grid for the whole week: the label column is as wide as the longest label, the days share the rest
 * but never get narrower than 5.25rem. `min-w` is 6rem of label + 7 days + 7 gaps + the padding (50rem), which
 * fits the editor at 1440 with the app sidebar and the side panel open; below that the grid keeps its width and scrolls inside {@link WEEK_GRID_SCROLLER_CLASS}.
 */
export const WEEK_GRID_CLASS =
  'grid min-w-[50rem] grid-cols-[max-content_repeat(7,minmax(5.25rem,1fr))] gap-3 rounded-2xl bg-grid p-3';

/** Wraps a week grid so a narrow editor scrolls it sideways instead of squeezing the days. */
export const WEEK_GRID_SCROLLER_CLASS = 'flex min-w-0 flex-1 flex-col overflow-x-auto rounded-2xl';

/** A row label that stays in view while the grid scrolls sideways. */
export const STICKY_LABEL_CLASS = 'sticky left-0 z-10 -ml-3 bg-grid pl-3';

/** A row of the week grid, aligned to its columns. */
export const GRID_CLASS = 'grid grid-cols-subgrid col-span-8 items-center';

/** Rows: header and day totals by content, then the meal rows share the free height. */
export function weekGridRows(mealRowCount: number, minRowRem: number): { gridTemplateRows: string } {
  return { gridTemplateRows: `auto auto repeat(${mealRowCount}, minmax(${minRowRem}rem, 1fr))` };
}

export function formatKcal(value: number, language: string): string {
  return Math.round(value).toLocaleString(language);
}

/** Row label key for a meal kind. */
export function mealKindLabelKey(kind: MealKind): string {
  switch (kind) {
    case MealKind.MorningSnack:
      return 'morningSnack';
    case MealKind.AfternoonSnack:
      return 'afternoonSnack';
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
