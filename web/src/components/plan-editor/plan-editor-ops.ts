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

export function kindRank(kind: MealKind): number {
  return CHRONOLOGICAL_KINDS.indexOf(kind);
}

/** Sorts kinds into the order a day runs. */
export function sortKinds(kinds: readonly MealKind[]): MealKind[] {
  return [...kinds].sort((left, right) => kindRank(left) - kindRank(right));
}

export interface GridRow {
  /** Position of the row in the week grid. */
  index: number;
  kind: MealKind;
  /** 0 for the first meal of this kind in a day, 1 for a second one, and so on. */
  occurrence: number;
}

/**
 * Rows of a week, keyed by (meal kind, occurrence): the union of kinds across the week's days in
 * chronological order. A kind repeated within one day adds an occurrence.
 */
export function weekRows(week: EditorWeek): GridRow[] {
  const occurrences = new Map<MealKind, number>();
  for (const day of week.days) {
    const counts = new Map<MealKind, number>();
    for (const meal of day.meals) {
      counts.set(meal.kind, (counts.get(meal.kind) ?? 0) + 1);
    }
    for (const [kind, count] of counts) {
      occurrences.set(kind, Math.max(occurrences.get(kind) ?? 0, count));
    }
  }
  const rows: GridRow[] = [];
  for (const kind of sortKinds([...occurrences.keys()])) {
    for (let occurrence = 0; occurrence < (occurrences.get(kind) ?? 0); occurrence += 1) {
      rows.push({ index: rows.length, kind, occurrence });
    }
  }
  return rows;
}

/** The day's meal that sits in the given row, if it has one. */
export function rowMeal(day: EditorDay | undefined, row: GridRow | undefined): EditorMeal | undefined {
  if (!day || !row) {
    return undefined;
  }
  return day.meals.filter((meal) => meal.kind === row.kind)[row.occurrence];
}

/** The row each of a day's meals sits in, by meal id. */
export function dayRowIndexes(week: EditorWeek, day: EditorDay | undefined): Map<string, number> {
  const result = new Map<string, number>();
  const seen = new Map<MealKind, number>();
  const rows = weekRows(week);
  for (const meal of day?.meals ?? []) {
    const occurrence = seen.get(meal.kind) ?? 0;
    seen.set(meal.kind, occurrence + 1);
    const row = rows.find((candidate) => candidate.kind === meal.kind && candidate.occurrence === occurrence);
    if (row) {
      result.set(meal.mealId, row.index);
    }
  }
  return result;
}

/** True when every weekday of the week already has a meal of the kind. */
export function everyDayHasKind(week: EditorWeek, kind: MealKind): boolean {
  return Array.from({ length: DAYS_PER_WEEK }, (_, index) => index + 1).every((dayOfWeek) =>
    week.days.find((day) => day.dayOfWeek === dayOfWeek)?.meals.some((meal) => meal.kind === kind),
  );
}

/** The first kind strictly between the two (chronologically) that `isFree` accepts, or null when none fits. */
export function fittingKind(above: MealKind, below: MealKind, isFree: (kind: MealKind) => boolean): MealKind | null {
  return (
    CHRONOLOGICAL_KINDS.find(
      (kind) => kindRank(kind) > kindRank(above) && kindRank(kind) < kindRank(below) && isFree(kind),
    ) ?? null
  );
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

/** Places a meal after the day's meals of the same or an earlier kind. */
function insertByKind(meals: EditorMeal[], created: EditorMeal): void {
  const firstLater = meals.findIndex((meal) => kindRank(meal.kind) > kindRank(created.kind));
  meals.splice(firstLater === -1 ? meals.length : firstLater, 0, created);
}

function dayOf(week: EditorWeek, dayOfWeek: number): EditorDay {
  return week.days.find((candidate) => candidate.dayOfWeek === dayOfWeek) ?? emptyDay(dayOfWeek, []);
}

/** Adds one meal of the given kind to every day of a week, keeping each day in order. */
export function addMealRow(doc: EditorDocument, weekIndex: number, kind: MealKind): EditorDocument {
  return updateWeek(doc, weekIndex, (week) => ({
    ...week,
    days: Array.from({ length: DAYS_PER_WEEK }, (_, dayIndex) => {
      const day = dayOf(week, dayIndex + 1);
      const meals = [...day.meals];
      insertByKind(meals, newMeal(kind, 0));
      return { ...day, meals: renumber(meals) };
    }),
  }));
}

/** How a week stands for adding one meal of a kind to every day that lacks it. */
export interface WeekKindPresence {
  /** Weekdays that already have the kind. */
  present: number[];
  /** Weekdays that lack it and have room for it. */
  addable: number[];
  /** Weekdays that lack it but are at the daily meal cap. */
  capped: number[];
}

export function weekKindPresence(week: EditorWeek, kind: MealKind): WeekKindPresence {
  const result: WeekKindPresence = { present: [], addable: [], capped: [] };
  for (let dayOfWeek = 1; dayOfWeek <= DAYS_PER_WEEK; dayOfWeek += 1) {
    const day = week.days.find((candidate) => candidate.dayOfWeek === dayOfWeek);
    if (day?.meals.some((meal) => meal.kind === kind)) {
      result.present.push(dayOfWeek);
    } else if ((day?.meals.length ?? 0) >= MAX_MEALS_PER_DAY) {
      result.capped.push(dayOfWeek);
    } else {
      result.addable.push(dayOfWeek);
    }
  }
  return result;
}

/** Adds an empty meal of the kind to each day of the week that lacks one; days at the cap are skipped. */
export function addKindToWeek(doc: EditorDocument, weekIndex: number, kind: MealKind): EditorDocument {
  const week = doc.weeks[weekIndex];
  if (!week) {
    return doc;
  }
  const { addable } = weekKindPresence(week, kind);
  if (addable.length === 0) {
    return doc;
  }
  return updateWeek(doc, weekIndex, (current) => ({
    ...current,
    days: Array.from({ length: DAYS_PER_WEEK }, (_, dayIndex) => {
      const day = dayOf(current, dayIndex + 1);
      if (!addable.includes(dayIndex + 1)) {
        return day;
      }
      const meals = [...day.meals];
      insertByKind(meals, newMeal(kind, 0));
      return { ...day, meals: renumber(meals) };
    }),
  }));
}

/** Weekdays (ascending) whose meal at the given row holds a recipe or ingredient. */
export function daysWithFoodInRow(week: EditorWeek, rowIndex: number): number[] {
  const row = weekRows(week)[rowIndex];
  return week.days
    .filter((day) => {
      const meal = rowMeal(day, row);
      return meal !== undefined && meal.foods.length + meal.recipes.length > 0;
    })
    .map((day) => day.dayOfWeek)
    .sort((left, right) => left - right);
}

/** Drops the meal of the row's kind and occurrence from every day of one week and renumbers what is left. */
export function removeMealRow(doc: EditorDocument, weekIndex: number, rowIndex: number): EditorDocument {
  const week = doc.weeks[weekIndex];
  const row = week ? weekRows(week)[rowIndex] : undefined;
  if (!week || !row) {
    return doc;
  }
  return updateWeek(doc, weekIndex, (current) => ({
    ...current,
    days: current.days.map((day) => {
      const target = rowMeal(day, row);
      return target ? { ...day, meals: renumber(day.meals.filter((meal) => meal.mealId !== target.mealId)) } : day;
    }),
  }));
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

/** Drops the last week. A plan keeps at least one week, so a single-week document is returned unchanged. */
export function removeLastWeek(doc: EditorDocument): EditorDocument {
  return doc.weeks.length <= 1 ? doc : { ...doc, weeks: doc.weeks.slice(0, -1) };
}

/**
 * Makes sure the day has a meal in the row, creating empty ones of the row's kind when it does not.
 * Returns null when that would push the day over the meal cap.
 */
function withRowMeal(meals: EditorMeal[], row: GridRow): { meals: EditorMeal[]; mealId: string } | null {
  const sameKind = meals.filter((meal) => meal.kind === row.kind);
  const existing = sameKind[row.occurrence];
  if (existing) {
    return { meals, mealId: existing.mealId };
  }
  const missing = row.occurrence + 1 - sameKind.length;
  if (meals.length + missing > MAX_MEALS_PER_DAY) {
    return null;
  }
  const next = [...meals];
  let created = newMeal(row.kind, 0);
  for (let index = 0; index < missing; index += 1) {
    created = newMeal(row.kind, 0);
    insertByKind(next, created);
  }
  return { meals: renumber(next), mealId: created.mealId };
}

/** Puts a recipe or ingredient into the meal at the given cell, creating the meal when the day lacks it. */
export function addItemToCell(
  doc: EditorDocument,
  weekIndex: number,
  dayOfWeek: number,
  rowIndex: number,
  item: LibraryItem,
): EditorDocument {
  const week = doc.weeks[weekIndex];
  const row = week ? weekRows(week)[rowIndex] : undefined;
  if (!week || !row) {
    return doc;
  }
  return updateDay(doc, weekIndex, dayOfWeek, (day) => {
    const placed = withRowMeal(day.meals, row);
    if (!placed) {
      return day;
    }
    return {
      ...day,
      meals: placed.meals.map((meal) => {
        if (meal.mealId !== placed.mealId) {
          return meal;
        }
        return item.type === 'recipe'
          ? { ...meal, recipes: [...meal.recipes, item.recipe] }
          : { ...meal, foods: [...meal.foods, item.food] };
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

/** Inserts an empty meal into one day at its kind's place in the day's order. Unchanged at the cap. */
export function addMealToDay(
  doc: EditorDocument,
  weekIndex: number,
  dayOfWeek: number,
  kind: MealKind,
  note?: string,
): EditorDocument {
  return updateDay(doc, weekIndex, dayOfWeek, (day) => {
    if (day.meals.length >= MAX_MEALS_PER_DAY) {
      return day;
    }
    const meals = [...day.meals];
    insertByKind(meals, { ...newMeal(kind, 0), note: note ? blankToUndefined(note) : undefined });
    return { ...day, meals: renumber(meals) };
  });
}

export function removeMeal(doc: EditorDocument, weekIndex: number, dayOfWeek: number, mealId: string): EditorDocument {
  return updateDay(doc, weekIndex, dayOfWeek, (day) => ({
    ...day,
    meals: renumber(day.meals.filter((meal) => meal.mealId !== mealId)),
  }));
}

/** Moves one recipe or ingredient to another position within its own list of a meal. */
export function reorderMealItems(
  doc: EditorDocument,
  weekIndex: number,
  dayOfWeek: number,
  mealId: string,
  kind: 'recipe' | 'food',
  from: number,
  to: number,
): EditorDocument {
  const moveWithin = <T>(items: readonly T[]): T[] => {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
      return [...items];
    }
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  };
  return updateMeal(doc, weekIndex, dayOfWeek, mealId, (meal) =>
    from === to
      ? meal
      : kind === 'recipe'
        ? { ...meal, recipes: moveWithin(meal.recipes) }
        : { ...meal, foods: moveWithin(meal.foods) },
  );
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
 * Copies a meal's items and note into the meal of the same kind and occurrence on each chosen weekday,
 * creating the meal when that day lacks it and replacing whatever items it had.
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
  const sourceMeal = source?.meals.find((meal) => meal.mealId === mealId);
  if (!week || !source || !sourceMeal) {
    return doc;
  }
  const row: GridRow = {
    index: -1,
    kind: sourceMeal.kind,
    occurrence: source.meals.filter((meal) => meal.kind === sourceMeal.kind).indexOf(sourceMeal),
  };
  return updateWeek(doc, weekIndex, (current) => ({
    ...current,
    days: current.days.map((day) => {
      if (day.dayOfWeek === sourceDay || !targetDays.includes(day.dayOfWeek)) {
        return day;
      }
      const placed = withRowMeal(day.meals, row);
      if (!placed) {
        return day;
      }
      return {
        ...day,
        meals: placed.meals.map((meal) => (meal.mealId === placed.mealId ? copyContents(sourceMeal, meal) : meal)),
      };
    }),
  }));
}

/** A day's meals in the order the day runs: chronological kind, then stored order. */
export function daySlots(day: EditorDay | undefined): EditorMeal[] {
  return (day?.meals ?? [])
    .map((meal, position) => ({ meal, position }))
    .sort((left, right) => kindRank(left.meal.kind) - kindRank(right.meal.kind) || left.position - right.position)
    .map((entry) => entry.meal);
}

type MealContents = Pick<EditorMeal, 'foods' | 'recipes' | 'note'>;

function contentsOf(meal: EditorMeal): MealContents {
  return { foods: meal.foods, recipes: meal.recipes, note: meal.note };
}

/** The slot a meal's contents end up in when moved from `fromIndex` to the gap before `gapIndex`. */
export function movedSlotIndex(fromIndex: number, gapIndex: number, slotCount: number): number {
  const to = gapIndex > fromIndex ? gapIndex - 1 : gapIndex;
  return Math.min(Math.max(to, 0), slotCount - 1);
}

/**
 * Moves one meal's contents (items, recipes and note) to the gap before slot `gapIndex` of its day, in
 * {@link daySlots} order, and shifts the contents in between by one slot. Every meal the day has takes part,
 * empty ones included; ids, kinds, order and times stay with their slots, and no meal is created.
 */
export function moveMealContents(
  doc: EditorDocument,
  weekIndex: number,
  dayOfWeek: number,
  mealId: string,
  gapIndex: number,
): EditorDocument {
  const day = doc.weeks[weekIndex]?.days.find((candidate) => candidate.dayOfWeek === dayOfWeek);
  const slots = daySlots(day);
  const from = slots.findIndex((meal) => meal.mealId === mealId);
  if (from === -1) {
    return doc;
  }
  const to = movedSlotIndex(from, gapIndex, slots.length);
  if (to === from) {
    return doc;
  }
  const contents = slots.map(contentsOf);
  const [moved] = contents.splice(from, 1);
  contents.splice(to, 0, moved);
  const byMealId = new Map(slots.map((meal, index) => [meal.mealId, contents[index]]));
  return updateDay(doc, weekIndex, dayOfWeek, (current) => ({
    ...current,
    meals: current.meals.map((meal) => {
      const next = byMealId.get(meal.mealId);
      return next ? { ...meal, ...next } : meal;
    }),
  }));
}

/** Swaps the items, recipes and note of two meals of one week; ids, kinds, order and times stay put. */
export function swapMealContents(
  doc: EditorDocument,
  weekIndex: number,
  first: { dayOfWeek: number; mealId: string },
  second: { dayOfWeek: number; mealId: string },
): EditorDocument {
  const week = doc.weeks[weekIndex];
  const findMeal = (ref: { dayOfWeek: number; mealId: string }) =>
    week?.days.find((day) => day.dayOfWeek === ref.dayOfWeek)?.meals.find((meal) => meal.mealId === ref.mealId);
  const firstMeal = findMeal(first);
  const secondMeal = findMeal(second);
  if (!firstMeal || !secondMeal || firstMeal.mealId === secondMeal.mealId) {
    return doc;
  }
  const firstContents = contentsOf(firstMeal);
  const secondContents = contentsOf(secondMeal);
  return updateWeek(doc, weekIndex, (current) => ({
    ...current,
    days: current.days.map((day) => ({
      ...day,
      meals: day.meals.map((meal) =>
        meal.mealId === firstMeal.mealId
          ? { ...meal, ...secondContents }
          : meal.mealId === secondMeal.mealId
            ? { ...meal, ...firstContents }
            : meal,
      ),
    })),
  }));
}

export type CellCopyMode = 'replace' | 'add';

/**
 * Copies one meal onto the cell at `target` in the same week. An empty or missing target meal takes
 * the source's items and note; a filled one is either replaced (items and note) or extended with the
 * source's items (its own note stays, the source's note fills in when it has none). Dropping a meal
 * on its own cell changes nothing.
 */
export function copyMealToCell(
  doc: EditorDocument,
  weekIndex: number,
  source: { dayOfWeek: number; mealId: string },
  target: { dayOfWeek: number; rowIndex: number },
  mode: CellCopyMode,
): EditorDocument {
  const week = doc.weeks[weekIndex];
  const sourceMeal = week?.days.find((day) => day.dayOfWeek === source.dayOfWeek)?.meals.find((meal) => meal.mealId === source.mealId);
  const targetDay = week?.days.find((day) => day.dayOfWeek === target.dayOfWeek);
  const row = week ? weekRows(week)[target.rowIndex] : undefined;
  if (!week || !sourceMeal || !targetDay || !row || rowMeal(targetDay, row)?.mealId === source.mealId) {
    return doc;
  }
  return updateDay(doc, weekIndex, target.dayOfWeek, (day) => {
    const placed = withRowMeal(day.meals, row);
    if (!placed) {
      return day;
    }
    return {
      ...day,
      meals: placed.meals.map((existing) => {
        if (existing.mealId !== placed.mealId) {
          return existing;
        }
        const filled = existing.foods.length + existing.recipes.length > 0;
        if (mode === 'replace' || !filled) {
          return copyContents(sourceMeal, existing);
        }
        const copy = copyContents(sourceMeal, existing);
        return {
          ...existing,
          note: existing.note ?? sourceMeal.note,
          foods: [...existing.foods, ...copy.foods],
          recipes: [...existing.recipes, ...copy.recipes],
        };
      }),
    };
  });
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
