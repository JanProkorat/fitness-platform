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
function withRowMeal(
  meals: EditorMeal[],
  row: GridRow,
  cap: number = MAX_MEALS_PER_DAY,
): { meals: EditorMeal[]; mealId: string } | null {
  const sameKind = meals.filter((meal) => meal.kind === row.kind);
  const existing = sameKind[row.occurrence];
  if (existing) {
    return { meals, mealId: existing.mealId };
  }
  const missing = row.occurrence + 1 - sameKind.length;
  if (meals.length + missing > cap) {
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

/** The gap a plain drop on slot `hoverIndex` stands for when the dragged contents start at slot `fromIndex`. */
export function gapForSlot(fromIndex: number, hoverIndex: number): number {
  return hoverIndex > fromIndex ? hoverIndex + 1 : hoverIndex;
}

/** After moving the contents of slot `fromIndex` to slot `toIndex`: for each slot, the slot its contents came from. */
export function slotOrigins(slotCount: number, fromIndex: number, toIndex: number): number[] {
  const origins = Array.from({ length: slotCount }, (_, index) => index);
  if (fromIndex < 0 || fromIndex >= slotCount || toIndex < 0 || toIndex >= slotCount) {
    return origins;
  }
  const [moved] = origins.splice(fromIndex, 1);
  origins.splice(toIndex, 0, moved);
  return origins;
}

/** A cell of the week grid: a weekday and a row index in {@link weekRows}. */
export interface CellRef {
  dayOfWeek: number;
  rowIndex: number;
}

/** The contents of the cell `from` end up in the cell `to`. */
export interface CellFlip {
  from: CellRef;
  to: CellRef;
}

/** Where the contents of the slots of one day go when the slot contents become `origins` (see {@link slotOrigins}). */
function slotPlacement(
  week: EditorWeek,
  dayOfWeek: number,
  slots: readonly EditorMeal[],
  origins: readonly number[],
): CellFlip[] {
  const rows = dayRowIndexes(
    week,
    week.days.find((day) => day.dayOfWeek === dayOfWeek),
  );
  const placement: CellFlip[] = [];
  for (const [position, origin] of origins.entries()) {
    const fromRow = rows.get(slots[origin]?.mealId ?? '');
    const toRow = rows.get(slots[position]?.mealId ?? '');
    if (origin !== position && fromRow !== undefined && toRow !== undefined) {
      placement.push({ from: { dayOfWeek, rowIndex: fromRow }, to: { dayOfWeek, rowIndex: toRow } });
    }
  }
  return placement;
}

/**
 * Where the contents go when one meal's contents move to the gap before slot `gapIndex` of its day, in
 * {@link daySlots} order, and the contents in between shift by one slot. Every meal the day has takes part,
 * empty ones included.
 */
export function columnMovePlacement(
  week: EditorWeek,
  dayOfWeek: number,
  mealId: string,
  gapIndex: number,
): CellFlip[] {
  const slots = daySlots(week.days.find((candidate) => candidate.dayOfWeek === dayOfWeek));
  const from = slots.findIndex((meal) => meal.mealId === mealId);
  if (from === -1) {
    return [];
  }
  const to = movedSlotIndex(from, gapIndex, slots.length);
  return to === from ? [] : slotPlacement(week, dayOfWeek, slots, slotOrigins(slots.length, from, to));
}

/**
 * Where the contents go when a meal's contents move along its row from weekday `fromDay` to weekday `toDay`: only the
 * days that have a meal in the row take part (empty meals included), the others are skipped.
 */
export function rowMovePlacement(week: EditorWeek, rowIndex: number, fromDay: number, toDay: number): CellFlip[] {
  const row = weekRows(week)[rowIndex];
  if (!row) {
    return [];
  }
  const days = week.days
    .filter((day) => rowMeal(day, row) !== undefined)
    .map((day) => day.dayOfWeek)
    .sort((left, right) => left - right);
  const from = days.indexOf(fromDay);
  const hover = days.indexOf(toDay);
  if (from === -1 || hover === -1 || from === hover) {
    return [];
  }
  const to = movedSlotIndex(from, gapForSlot(from, hover), days.length);
  return slotOrigins(days.length, from, to).flatMap((origin, position) =>
    origin === position
      ? []
      : [{ from: { dayOfWeek: days[origin], rowIndex }, to: { dayOfWeek: days[position], rowIndex } }],
  );
}

/**
 * Where the contents go when row `fromRow` moves onto row `toRow`: in each day that has a meal in both rows, the
 * contents of the first move to the second as in {@link columnMovePlacement}. A day lacking either row stays as it is.
 */
export function rowLabelPlacement(week: EditorWeek, fromRow: number, toRow: number): CellFlip[] {
  const rows = weekRows(week);
  const from = rows[fromRow];
  const to = rows[toRow];
  if (!from || !to || fromRow === toRow) {
    return [];
  }
  return week.days.flatMap((day) => {
    const source = rowMeal(day, from);
    const target = rowMeal(day, to);
    if (!source || !target) {
      return [];
    }
    const slots = daySlots(day);
    const sourceSlot = slots.findIndex((meal) => meal.mealId === source.mealId);
    const targetSlot = slots.findIndex((meal) => meal.mealId === target.mealId);
    return columnMovePlacement(week, day.dayOfWeek, source.mealId, gapForSlot(sourceSlot, targetSlot));
  });
}

/** Puts the contents of every `from` cell into its `to` cell, resolved against the week as it was; ids, kinds, order and times stay. */
function applyPlacement(doc: EditorDocument, weekIndex: number, placement: readonly CellFlip[]): EditorDocument {
  const week = doc.weeks[weekIndex];
  if (!week || placement.length === 0) {
    return doc;
  }
  const rows = weekRows(week);
  const mealAt = (cell: CellRef) =>
    rowMeal(
      week.days.find((day) => day.dayOfWeek === cell.dayOfWeek),
      rows[cell.rowIndex],
    );
  const incoming = new Map<string, MealContents>();
  for (const { from, to } of placement) {
    const source = mealAt(from);
    const target = mealAt(to);
    if (source && target) {
      incoming.set(target.mealId, contentsOf(source));
    }
  }
  if (incoming.size === 0) {
    return doc;
  }
  return updateWeek(doc, weekIndex, (current) => ({
    ...current,
    days: current.days.map((day) =>
      day.meals.some((meal) => incoming.has(meal.mealId))
        ? {
            ...day,
            meals: day.meals.map((meal) => {
              const next = incoming.get(meal.mealId);
              return next ? { ...meal, ...next } : meal;
            }),
          }
        : day,
    ),
  }));
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
  const week = doc.weeks[weekIndex];
  return week ? applyPlacement(doc, weekIndex, columnMovePlacement(week, dayOfWeek, mealId, gapIndex)) : doc;
}

/** Moves a meal's contents along its row to another weekday; see {@link rowMovePlacement}. */
export function moveMealAlongRow(
  doc: EditorDocument,
  weekIndex: number,
  rowIndex: number,
  fromDay: number,
  toDay: number,
): EditorDocument {
  const week = doc.weeks[weekIndex];
  return week ? applyPlacement(doc, weekIndex, rowMovePlacement(week, rowIndex, fromDay, toDay)) : doc;
}

/** The weekdays a day move touches, in order, and for each the position (in that list) its contents come from. */
function dayRange(move: { from: number; to: number }): { days: number[]; origins: number[] } | null {
  const first = Math.min(move.from, move.to);
  const last = Math.max(move.from, move.to);
  if (move.from === move.to || first < 1 || last > DAYS_PER_WEEK) {
    return null;
  }
  const days = Array.from({ length: last - first + 1 }, (_, index) => first + index);
  return { days, origins: slotOrigins(days.length, move.from - first, move.to - first) };
}

/**
 * Where the contents go when a day moves onto another day: every day between them takes the meals of the day it
 * receives from, so each meal keeps its row.
 */
export function dayMovePlacement(week: EditorWeek, fromDay: number, toDay: number): CellFlip[] {
  const range = dayRange({ from: fromDay, to: toDay });
  if (!range) {
    return [];
  }
  return range.origins.flatMap((origin, position) => {
    if (origin === position) {
      return [];
    }
    const originDay = range.days[origin];
    const rows = dayRowIndexes(
      week,
      week.days.find((day) => day.dayOfWeek === originDay),
    );
    return [...rows.values()].map((rowIndex) => ({
      from: { dayOfWeek: originDay, rowIndex },
      to: { dayOfWeek: range.days[position], rowIndex },
    }));
  });
}

/**
 * Moves a day onto another day as an exact rotation: each day from one to the other takes the kinds and contents
 * of the day it receives from, and day notes stay. A meal keeps the id and time of the receiving day's meal of the
 * same kind and position; meals with no such match get a new id. The meal count of every day is one the week
 * already had, so no day passes the cap and no id is used twice.
 */
export function moveDayContents(doc: EditorDocument, weekIndex: number, fromDay: number, toDay: number): EditorDocument {
  const week = doc.weeks[weekIndex];
  const range = dayRange({ from: fromDay, to: toDay });
  if (!week || !range) {
    return doc;
  }
  const rotated = new Map<number, EditorMeal[]>();
  for (const [position, origin] of range.origins.entries()) {
    if (origin === position) {
      continue;
    }
    const receiving = dayOf(week, range.days[position]);
    const slotKey = (kind: MealKind, occurrence: number) => `${kind}:${occurrence}`;
    const receivingBySlot = new Map<string, EditorMeal>();
    const receivingSeen = new Map<MealKind, number>();
    for (const meal of receiving.meals) {
      const occurrence = receivingSeen.get(meal.kind) ?? 0;
      receivingSeen.set(meal.kind, occurrence + 1);
      receivingBySlot.set(slotKey(meal.kind, occurrence), meal);
    }
    const seen = new Map<MealKind, number>();
    const meals = dayOf(week, range.days[origin]).meals.map((meal) => {
      const occurrence = seen.get(meal.kind) ?? 0;
      seen.set(meal.kind, occurrence + 1);
      const match = receivingBySlot.get(slotKey(meal.kind, occurrence));
      return {
        ...copyContents(meal, meal),
        mealId: match?.mealId ?? crypto.randomUUID(),
        time: match ? match.time : meal.time,
      };
    });
    rotated.set(range.days[position], renumber(meals));
  }
  return updateWeek(doc, weekIndex, (current) => ({
    ...current,
    days: current.days.map((day) => {
      const meals = rotated.get(day.dayOfWeek);
      return meals ? { ...day, meals } : day;
    }),
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

export type LabelAxis = 'row' | 'day';

/** A row label dropped on another row (indexes in {@link weekRows}), or a day label dropped on another day (1-7). */
export interface LabelMove {
  axis: LabelAxis;
  from: number;
  to: number;
}

/** `copy` is `replace` that leaves a target alone when its source cell is empty; it is what an Alt drop on an empty target does. */
export type LabelOpMode = 'replace' | 'append' | 'copy';

interface MealSlot {
  dayOfWeek: number;
  kind: MealKind;
  occurrence: number;
}

interface SlotPair {
  source: MealSlot;
  target: MealSlot;
}

const WEEKDAYS = Array.from({ length: DAYS_PER_WEEK }, (_, index) => index + 1);
const BLANK_CONTENTS: MealContents = { foods: [], recipes: [], note: undefined };

function slotMeal(week: EditorWeek, slot: MealSlot): EditorMeal | undefined {
  return rowMeal(
    week.days.find((day) => day.dayOfWeek === slot.dayOfWeek),
    { index: -1, kind: slot.kind, occurrence: slot.occurrence },
  );
}

function hasItems(contents: Pick<EditorMeal, 'foods' | 'recipes'>): boolean {
  return contents.foods.length + contents.recipes.length > 0;
}

function isEmptyContents(contents: MealContents): boolean {
  return !hasItems(contents) && !contents.note;
}

function cloneContents(contents: MealContents): MealContents {
  return {
    foods: contents.foods.map((food) => ({ ...food })),
    recipes: contents.recipes.map((recipe) => ({ ...recipe })),
    note: contents.note,
  };
}

/** The cell pairs of a label move, grouped by what a daily meal cap judges together: a day for a row move, the two days for a day move. */
function labelGroups(week: EditorWeek, move: LabelMove): SlotPair[][] {
  if (move.from === move.to) {
    return [];
  }
  if (move.axis === 'row') {
    const rows = weekRows(week);
    const from = rows[move.from];
    const to = rows[move.to];
    if (!from || !to) {
      return [];
    }
    return WEEKDAYS.map((dayOfWeek) => [
      {
        source: { dayOfWeek, kind: from.kind, occurrence: from.occurrence },
        target: { dayOfWeek, kind: to.kind, occurrence: to.occurrence },
      },
    ]);
  }
  if (!WEEKDAYS.includes(move.from) || !WEEKDAYS.includes(move.to)) {
    return [];
  }
  return [
    weekRows(week).map((row) => ({
      source: { dayOfWeek: move.from, kind: row.kind, occurrence: row.occurrence },
      target: { dayOfWeek: move.to, kind: row.kind, occurrence: row.occurrence },
    })),
  ];
}

interface GroupResult {
  /** The new meal list of every day the group changed. */
  days: Map<number, EditorMeal[]>;
  /** Days the result would push past the daily meal cap. */
  overCap: number[];
  changed: boolean;
}

/**
 * Applies one group of cell pairs. Every pair's meals are resolved from the week as it was before the move, so
 * creating a meal never shifts what a later pair points at.
 */
function applyGroup(week: EditorWeek, pairs: readonly SlotPair[], mode: LabelOpMode): GroupResult {
  const days = new Map<number, EditorMeal[]>();
  let changed = false;
  const mealsOf = (dayOfWeek: number) => days.get(dayOfWeek) ?? dayOf(week, dayOfWeek).meals;
  const assign = (dayOfWeek: number, mealId: string, contents: MealContents) => {
    const filled = cloneContents(contents);
    days.set(
      dayOfWeek,
      mealsOf(dayOfWeek).map((meal) => (meal.mealId === mealId ? { ...meal, ...filled } : meal)),
    );
    changed = true;
  };
  const create = (slot: MealSlot, contents: MealContents) => {
    const placed = withRowMeal(
      mealsOf(slot.dayOfWeek),
      { index: -1, kind: slot.kind, occurrence: slot.occurrence },
      Number.POSITIVE_INFINITY,
    );
    if (placed) {
      days.set(slot.dayOfWeek, placed.meals);
      assign(slot.dayOfWeek, placed.mealId, contents);
    }
  };

  for (const pair of pairs) {
    const sourceMeal = slotMeal(week, pair.source);
    const targetMeal = slotMeal(week, pair.target);
    const sourceContents = sourceMeal ? contentsOf(sourceMeal) : undefined;
    const targetContents = targetMeal ? contentsOf(targetMeal) : undefined;
    const sourceFull = sourceContents !== undefined && !isEmptyContents(sourceContents);
    if (mode === 'append') {
      if (!sourceContents || !sourceFull) {
        continue;
      }
      if (!targetMeal || !targetContents) {
        create(pair.target, sourceContents);
      } else if (!hasItems(targetContents)) {
        assign(pair.target.dayOfWeek, targetMeal.mealId, sourceContents);
      } else {
        assign(pair.target.dayOfWeek, targetMeal.mealId, {
          foods: [...targetContents.foods, ...sourceContents.foods],
          recipes: [...targetContents.recipes, ...sourceContents.recipes],
          note: targetContents.note ?? sourceContents.note,
        });
      }
    } else if (!sourceContents || !sourceFull) {
      if (mode === 'replace' && targetMeal && targetContents && !isEmptyContents(targetContents)) {
        assign(pair.target.dayOfWeek, targetMeal.mealId, BLANK_CONTENTS);
      }
    } else if (targetMeal) {
      assign(pair.target.dayOfWeek, targetMeal.mealId, sourceContents);
    } else {
      create(pair.target, sourceContents);
    }
  }

  const overCap: number[] = [];
  for (const [dayOfWeek, meals] of days) {
    if (meals.length > MAX_MEALS_PER_DAY) {
      overCap.push(dayOfWeek);
    }
    days.set(dayOfWeek, renumber(meals));
  }
  return { days, overCap: overCap.sort((left, right) => left - right), changed };
}

export interface LabelOutcome {
  /** Whether the move changes anything. */
  changed: boolean;
  /** Weekdays left out because the result would hold more meals than a day may. */
  skippedDays: number[];
}

export interface LabelPreview {
  /** True when a target cell holds a recipe or ingredient, so the move needs a decision first. */
  targetHasFood: boolean;
  outcome: Record<LabelOpMode, LabelOutcome>;
}

const LABEL_OP_MODES: readonly LabelOpMode[] = ['replace', 'append', 'copy'];

/** What a label move would do in each mode, without doing it. */
export function previewLabelMove(week: EditorWeek, move: LabelMove): LabelPreview {
  const groups = labelGroups(week, move);
  const targetHasFood = groups.some((pairs) =>
    pairs.some((pair) => {
      const meal = slotMeal(week, pair.target);
      return meal !== undefined && hasItems(meal);
    }),
  );
  const outcome = {} as Record<LabelOpMode, LabelOutcome>;
  for (const mode of LABEL_OP_MODES) {
    const skipped = new Set<number>();
    let changed = false;
    for (const pairs of groups) {
      const result = applyGroup(week, pairs, mode);
      if (result.overCap.length > 0) {
        result.overCap.forEach((dayOfWeek) => skipped.add(dayOfWeek));
      } else if (result.changed) {
        changed = true;
      }
    }
    outcome[mode] = { changed, skippedDays: [...skipped].sort((left, right) => left - right) };
  }
  return { targetHasFood, outcome };
}

/**
 * Moves the contents (items, recipes and note) of one row onto another across every day of the week, or of one
 * day onto another across every row. Times and a day's own note stay put. Days the result would push past the
 * meal cap are left as they were; the document comes back unchanged when nothing applies.
 */
export function applyLabelMove(doc: EditorDocument, weekIndex: number, move: LabelMove, mode: LabelOpMode): EditorDocument {
  const week = doc.weeks[weekIndex];
  if (!week) {
    return doc;
  }
  const changedDays = new Map<number, EditorMeal[]>();
  for (const pairs of labelGroups(week, move)) {
    const result = applyGroup(week, pairs, mode);
    if (result.overCap.length === 0 && result.changed) {
      result.days.forEach((meals, dayOfWeek) => changedDays.set(dayOfWeek, meals));
    }
  }
  if (changedDays.size === 0) {
    return doc;
  }
  return updateWeek(doc, weekIndex, (current) => ({
    ...current,
    days: current.days.map((day) => {
      const meals = changedDays.get(day.dayOfWeek);
      return meals ? { ...day, meals } : day;
    }),
  }));
}

/**
 * Where the contents go when {@link applyLabelMove} runs with the same arguments: one entry per filled source cell.
 * Days the meal cap leaves out are skipped, as the move itself skips them.
 */
export function labelMoveFlips(week: EditorWeek, move: LabelMove, mode: LabelOpMode): CellFlip[] {
  const rows = weekRows(week);
  const cellOf = (slot: MealSlot): CellRef => ({
    dayOfWeek: slot.dayOfWeek,
    rowIndex: rows.findIndex((row) => row.kind === slot.kind && row.occurrence === slot.occurrence),
  });
  const filled = (slot: MealSlot) => {
    const meal = slotMeal(week, slot);
    return meal !== undefined && !isEmptyContents(contentsOf(meal));
  };
  const flips: CellFlip[] = [];
  for (const pairs of labelGroups(week, move)) {
    const result = applyGroup(week, pairs, mode);
    if (result.overCap.length > 0 || !result.changed) {
      continue;
    }
    for (const pair of pairs) {
      const source = cellOf(pair.source);
      const target = cellOf(pair.target);
      if (filled(pair.source)) {
        flips.push({ from: source, to: target });
      }
    }
  }
  return flips.filter((flip) => flip.from.rowIndex !== -1 && flip.to.rowIndex !== -1);
}

/** Where the contents go when a row or day label is moved (not copied) onto another one. */
export function labelMovePlacement(week: EditorWeek, move: LabelMove): CellFlip[] {
  return move.axis === 'row'
    ? rowLabelPlacement(week, move.from, move.to)
    : dayMovePlacement(week, move.from, move.to);
}

/**
 * Moves a row onto another row (contents only, per day, see {@link rowLabelPlacement}) or a day onto another day
 * (an exact rotation, see {@link moveDayContents}). It never creates a meal, so the daily meal cap never applies.
 */
export function moveLabel(doc: EditorDocument, weekIndex: number, move: LabelMove): EditorDocument {
  const week = doc.weeks[weekIndex];
  if (!week) {
    return doc;
  }
  return move.axis === 'row'
    ? applyPlacement(doc, weekIndex, rowLabelPlacement(week, move.from, move.to))
    : moveDayContents(doc, weekIndex, move.from, move.to);
}

function cellKey(cell: CellRef): string {
  return `${cell.dayOfWeek}:${cell.rowIndex}`;
}

/**
 * The slides that take a grid showing the contents placed by `before` to one showing `after`; both are placements
 * of the same untouched week, so a cell's contents are tracked from where they started.
 */
export function placementDiff(before: readonly CellFlip[], after: readonly CellFlip[]): CellFlip[] {
  const origins = new Map<string, CellRef>();
  for (const { from } of [...before, ...after]) {
    origins.set(cellKey(from), from);
  }
  const locate = (placement: readonly CellFlip[], origin: CellRef) =>
    placement.find((flip) => cellKey(flip.from) === cellKey(origin))?.to ?? origin;
  const slides: CellFlip[] = [];
  for (const origin of origins.values()) {
    const from = locate(before, origin);
    const to = locate(after, origin);
    if (cellKey(from) !== cellKey(to)) {
      slides.push({ from, to });
    }
  }
  return slides;
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
