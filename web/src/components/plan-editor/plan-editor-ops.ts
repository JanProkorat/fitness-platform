import { MealKind } from '@/api/generated';
import {
  DAYS_PER_WEEK,
  MAX_WEEKS,
  type EditorDay,
  type EditorDocument,
  type EditorMeal,
  type EditorWeek,
  type LibraryItem,
} from '@/components/plan-editor/plan-editor-types';

/** Slots in the order a day's meals run. */
export const CHRONOLOGICAL_KINDS: readonly MealKind[] = [
  MealKind.Breakfast,
  MealKind.MorningSnack,
  MealKind.Lunch,
  MealKind.AfternoonSnack,
  MealKind.Dinner,
  MealKind.PreWorkout,
  MealKind.PostWorkout,
];

/** The "most common" day: breakfast, one snack, lunch, dinner. */
export const COMMON_MEAL_KINDS: readonly MealKind[] = [
  MealKind.Breakfast,
  MealKind.MorningSnack,
  MealKind.Lunch,
  MealKind.Dinner,
];

function kindRank(kind: MealKind): number {
  return CHRONOLOGICAL_KINDS.indexOf(kind);
}

/** Sorts kinds into the order a day runs. */
export function sortKinds(kinds: readonly MealKind[]): MealKind[] {
  return [...kinds].sort((left, right) => kindRank(left) - kindRank(right));
}

export interface GridRow {
  index: number;
  kind: MealKind;
}

/** Row N of a week is the Nth meal of each day; its kind comes from the first day that has one. */
export function weekRows(week: EditorWeek): GridRow[] {
  const rowCount = Math.max(0, ...week.days.map((day) => day.meals.length));
  return Array.from({ length: rowCount }, (_, index) => {
    const meal = week.days.map((day) => day.meals[index]).find((candidate) => candidate !== undefined);
    return { index, kind: meal?.kind ?? MealKind.Breakfast };
  });
}

export function weekHasItems(week: EditorWeek): boolean {
  return week.days.some((day) => day.meals.some((meal) => meal.foods.length + meal.recipes.length > 0));
}

function newMeal(kind: MealKind, order: number): EditorMeal {
  return { mealId: crypto.randomUUID(), kind, order, foods: [], recipes: [] };
}

function emptyDay(dayOfWeek: number, kinds: readonly MealKind[]): EditorDay {
  return { dayOfWeek, meals: kinds.map((kind, index) => newMeal(kind, index + 1)) };
}

function updateWeek(doc: EditorDocument, weekIndex: number, update: (week: EditorWeek) => EditorWeek): EditorDocument {
  return { ...doc, weeks: doc.weeks.map((week, index) => (index === weekIndex ? update(week) : week)) };
}

/** Gives every given week with no meal rows the same rows, one meal per kind in day order. */
export function applyMealKinds(
  doc: EditorDocument,
  weekIndexes: readonly number[],
  kinds: readonly MealKind[],
): EditorDocument {
  const ordered = sortKinds(kinds);
  return {
    ...doc,
    weeks: doc.weeks.map((week, index) => {
      if (!weekIndexes.includes(index) || weekRows(week).length > 0) {
        return week;
      }
      return {
        ...week,
        days: Array.from({ length: DAYS_PER_WEEK }, (_, dayIndex) => {
          const existing = week.days.find((day) => day.dayOfWeek === dayIndex + 1);
          return { ...emptyDay(dayIndex + 1, ordered), note: existing?.note };
        }),
      };
    }),
  };
}

/** Adds one meal row of the given kind to a week, keeping the rows in day order. */
export function addMealRow(doc: EditorDocument, weekIndex: number, kind: MealKind): EditorDocument {
  return updateWeek(doc, weekIndex, (week) => {
    const rows = weekRows(week);
    const kinds = sortKinds([...rows.map((row) => row.kind), kind]);
    const insertAt = kinds.lastIndexOf(kind);
    return {
      ...week,
      days: Array.from({ length: DAYS_PER_WEEK }, (_, dayIndex) => {
        const day = week.days.find((candidate) => candidate.dayOfWeek === dayIndex + 1) ?? emptyDay(dayIndex + 1, []);
        const meals = [...day.meals];
        meals.splice(insertAt, 0, newMeal(kind, insertAt + 1));
        return { ...day, meals: meals.map((meal, order) => ({ ...meal, order: order + 1 })) };
      }),
    };
  });
}

/** A snack added to a day that already has one becomes the afternoon snack. */
export function nextSnackKind(week: EditorWeek): MealKind {
  const hasMorning = weekRows(week).some((row) => row.kind === MealKind.MorningSnack);
  return hasMorning ? MealKind.AfternoonSnack : MealKind.MorningSnack;
}

/** Appends an empty week that repeats the last week's meal rows. Returns the doc unchanged at the cap. */
export function addWeek(doc: EditorDocument): EditorDocument {
  if (doc.weeks.length >= MAX_WEEKS) {
    return doc;
  }
  const last = doc.weeks[doc.weeks.length - 1];
  const kinds = last ? weekRows(last).map((row) => row.kind) : [];
  const weekNumber = doc.weeks.length + 1;
  return {
    ...doc,
    weeks: [
      ...doc.weeks,
      { weekNumber, days: Array.from({ length: DAYS_PER_WEEK }, (_, index) => emptyDay(index + 1, kinds)) },
    ],
  };
}

/** Puts a recipe or ingredient into the meal at the given cell, creating the meal when the day lacks it. */
export function addItemToCell(
  doc: EditorDocument,
  weekIndex: number,
  dayOfWeek: number,
  rowIndex: number,
  item: LibraryItem,
): EditorDocument {
  return updateWeek(doc, weekIndex, (week) => {
    const rows = weekRows(week);
    return {
      ...week,
      days: week.days.map((day) => {
        if (day.dayOfWeek !== dayOfWeek) {
          return day;
        }
        const meals = [...day.meals];
        for (let index = meals.length; index <= rowIndex; index += 1) {
          meals.push(newMeal(rows[index]?.kind ?? MealKind.Breakfast, index + 1));
        }
        const target = meals[rowIndex];
        meals[rowIndex] =
          item.type === 'recipe'
            ? { ...target, recipes: [...target.recipes, item.recipe] }
            : { ...target, foods: [...target.foods, item.food] };
        return { ...day, meals };
      }),
    };
  });
}
