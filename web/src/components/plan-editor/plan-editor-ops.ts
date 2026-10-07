import { MealKind } from '@/api/generated';
import {
  DAYS_PER_WEEK,
  MAX_MEALS_PER_DAY,
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

function renumber(meals: EditorMeal[]): EditorMeal[] {
  return meals.map((meal, index) => (meal.order === index + 1 ? meal : { ...meal, order: index + 1 }));
}

function updateDay(
  doc: EditorDocument,
  weekIndex: number,
  dayOfWeek: number,
  update: (day: EditorDay) => EditorDay,
): EditorDocument {
  return updateWeek(doc, weekIndex, (week) => ({
    ...week,
    days: week.days.map((day) => (day.dayOfWeek === dayOfWeek ? update(day) : day)),
  }));
}

function updateMeal(
  doc: EditorDocument,
  weekIndex: number,
  dayOfWeek: number,
  mealId: string,
  update: (meal: EditorMeal) => EditorMeal,
): EditorDocument {
  return updateDay(doc, weekIndex, dayOfWeek, (day) => ({
    ...day,
    meals: day.meals.map((meal) => (meal.mealId === mealId ? update(meal) : meal)),
  }));
}

function blankToUndefined(value: string): string | undefined {
  return value.trim() === '' ? undefined : value;
}

export function setMealNote(
  doc: EditorDocument,
  weekIndex: number,
  dayOfWeek: number,
  mealId: string,
  note: string,
): EditorDocument {
  return updateMeal(doc, weekIndex, dayOfWeek, mealId, (meal) => ({ ...meal, note: blankToUndefined(note) }));
}

export function setDayNote(doc: EditorDocument, weekIndex: number, dayOfWeek: number, note: string): EditorDocument {
  return updateDay(doc, weekIndex, dayOfWeek, (day) => ({ ...day, note: blankToUndefined(note) }));
}

export function setFoodAmount(
  doc: EditorDocument,
  weekIndex: number,
  dayOfWeek: number,
  mealId: string,
  foodIndex: number,
  amountGrams: number,
): EditorDocument {
  return updateMeal(doc, weekIndex, dayOfWeek, mealId, (meal) => ({
    ...meal,
    foods: meal.foods.map((food, index) => (index === foodIndex ? { ...food, amountGrams } : food)),
  }));
}

export function setRecipeServings(
  doc: EditorDocument,
  weekIndex: number,
  dayOfWeek: number,
  mealId: string,
  recipeIndex: number,
  servings: number,
): EditorDocument {
  return updateMeal(doc, weekIndex, dayOfWeek, mealId, (meal) => ({
    ...meal,
    recipes: meal.recipes.map((recipe, index) => (index === recipeIndex ? { ...recipe, servings } : recipe)),
  }));
}

export function removeFoodAt(
  doc: EditorDocument,
  weekIndex: number,
  dayOfWeek: number,
  mealId: string,
  foodIndex: number,
): EditorDocument {
  return updateMeal(doc, weekIndex, dayOfWeek, mealId, (meal) => ({
    ...meal,
    foods: meal.foods.filter((_, index) => index !== foodIndex),
  }));
}

export function removeRecipeAt(
  doc: EditorDocument,
  weekIndex: number,
  dayOfWeek: number,
  mealId: string,
  recipeIndex: number,
): EditorDocument {
  return updateMeal(doc, weekIndex, dayOfWeek, mealId, (meal) => ({
    ...meal,
    recipes: meal.recipes.filter((_, index) => index !== recipeIndex),
  }));
}

/** Inserts an empty meal into one day after the meal at `afterIndex` (-1 = first). Unchanged at the cap. */
export function addMealToDay(
  doc: EditorDocument,
  weekIndex: number,
  dayOfWeek: number,
  kind: MealKind,
  afterIndex: number,
  note?: string,
): EditorDocument {
  return updateDay(doc, weekIndex, dayOfWeek, (day) => {
    if (day.meals.length >= MAX_MEALS_PER_DAY) {
      return day;
    }
    const meals = [...day.meals];
    const created: EditorMeal = { ...newMeal(kind, 0), note: note ? blankToUndefined(note) : undefined };
    meals.splice(Math.min(afterIndex + 1, meals.length), 0, created);
    return { ...day, meals: renumber(meals) };
  });
}

export function removeMeal(doc: EditorDocument, weekIndex: number, dayOfWeek: number, mealId: string): EditorDocument {
  return updateDay(doc, weekIndex, dayOfWeek, (day) => ({
    ...day,
    meals: renumber(day.meals.filter((meal) => meal.mealId !== mealId)),
  }));
}

/** Puts a day's meals in the given id order; ids not listed keep their relative place at the end. */
export function reorderMeals(
  doc: EditorDocument,
  weekIndex: number,
  dayOfWeek: number,
  orderedIds: readonly string[],
): EditorDocument {
  return updateDay(doc, weekIndex, dayOfWeek, (day) => {
    const rank = (meal: EditorMeal) => {
      const position = orderedIds.indexOf(meal.mealId);
      return position === -1 ? orderedIds.length : position;
    };
    const sorted = [...day.meals].sort((left, right) => rank(left) - rank(right));
    return sorted.every((meal, index) => meal === day.meals[index]) ? day : { ...day, meals: renumber(sorted) };
  });
}

function copyContents(source: EditorMeal, target: EditorMeal): EditorMeal {
  return {
    ...target,
    note: source.note,
    foods: source.foods.map((food) => ({ ...food })),
    recipes: source.recipes.map((recipe) => ({ ...recipe })),
  };
}

/**
 * Copies a meal's items and note into the meal at the same row on each chosen weekday, creating the
 * meal when that day is shorter and replacing whatever items it had.
 */
export function copyMealToDays(
  doc: EditorDocument,
  weekIndex: number,
  sourceDay: number,
  mealId: string,
  targetDays: readonly number[],
): EditorDocument {
  const week = doc.weeks[weekIndex];
  const source = week?.days.find((day) => day.dayOfWeek === sourceDay);
  const rowIndex = source?.meals.findIndex((meal) => meal.mealId === mealId) ?? -1;
  const sourceMeal = source?.meals[rowIndex];
  if (!source || !sourceMeal) {
    return doc;
  }
  return updateWeek(doc, weekIndex, (current) => ({
    ...current,
    days: current.days.map((day) => {
      if (day.dayOfWeek === sourceDay || !targetDays.includes(day.dayOfWeek)) {
        return day;
      }
      const meals = [...day.meals];
      for (let index = meals.length; index <= rowIndex; index += 1) {
        const kind = index === rowIndex ? sourceMeal.kind : (source.meals[index]?.kind ?? sourceMeal.kind);
        meals.push(newMeal(kind, index + 1));
      }
      meals[rowIndex] = copyContents(sourceMeal, meals[rowIndex]);
      return { ...day, meals: renumber(meals) };
    }),
  }));
}

/**
 * Replaces an empty week's meals with a copy of another plan's week (items and notes, new ids); every
 * other week without meals gets the same rows, empty. Weeks that already have meals are left alone.
 */
export function copyWeekMeals(doc: EditorDocument, weekIndex: number, sourceWeek: EditorWeek): EditorDocument {
  const copiedDays: EditorDay[] = Array.from({ length: DAYS_PER_WEEK }, (_, dayIndex) => {
    const sourceDay = sourceWeek.days.find((day) => day.dayOfWeek === dayIndex + 1);
    return {
      dayOfWeek: dayIndex + 1,
      note: sourceDay?.note,
      meals: renumber(
        (sourceDay?.meals ?? []).slice(0, MAX_MEALS_PER_DAY).map((meal) => ({
          ...copyContents(meal, newMeal(meal.kind, meal.order)),
          time: meal.time,
        })),
      ),
    };
  });
  const rowKinds = weekRows({ weekNumber: 0, days: copiedDays }).map((row) => row.kind);
  return {
    ...doc,
    weeks: doc.weeks.map((week, index) => {
      if (weekRows(week).length > 0) {
        return week;
      }
      if (index === weekIndex) {
        return { ...week, days: copiedDays.map((day) => ({ ...day, meals: day.meals.map((meal) => ({ ...meal })) })) };
      }
      return {
        ...week,
        days: Array.from({ length: DAYS_PER_WEEK }, (_, dayIndex) => {
          const existing = week.days.find((day) => day.dayOfWeek === dayIndex + 1);
          return { ...emptyDay(dayIndex + 1, rowKinds), note: existing?.note };
        }),
      };
    }),
  };
}

/** The snack kind a day gets next: the second snack of a day is the afternoon one. */
export function nextSnackKindForDay(day: EditorDay | undefined): MealKind {
  return day?.meals.some((meal) => meal.kind === MealKind.MorningSnack) ? MealKind.AfternoonSnack : MealKind.MorningSnack;
}
