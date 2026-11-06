import {
  MealItemConflictTag,
  SeenMealItemKind,
  type EatenMealItem,
  type MealKind,
  type OfflineSyncConflictDto,
} from '@/api/generated';
import { planPositionOfDate } from '@/components/client-plan-editor/clientPlanDates';
import { eatenSnapshotKcal, type EatenView, type PlanMealLocks } from '@/components/plan-editor/meal-locks';
import { foodDisplayName } from '@/components/plan-editor/plan-editor-library';
import { foodTotals, mealTotals, recipeTotals, type Totals } from '@/components/plan-editor/plan-editor-nutrition';
import { rowMeal, weekRows } from '@/components/plan-editor/plan-editor-ops';
import type { EditorDocument, EditorMeal, EditorWeek } from '@/components/plan-editor/plan-editor-types';

/** An unreviewed conflict tied to the place it shows in the editor. */
export interface PlacedConflict {
  id: string;
  conflict: OfflineSyncConflictDto;
  /** The week and weekday it shows on; null when it cannot be placed, so only the strip counts it. */
  weekIndex: number | null;
  dayOfWeek: number | null;
  /** The meal as the plan holds it now; undefined for a meal that has left the plan (a ghost). */
  meal: EditorMeal | undefined;
  ghost: boolean;
}

function findMeal(
  doc: EditorDocument,
  mealId: string,
  near: { weekIndex: number; dayOfWeek: number } | null,
): { weekIndex: number; dayOfWeek: number; meal: EditorMeal } | null {
  if (near) {
    const day = doc.weeks[near.weekIndex]?.days.find((candidate) => candidate.dayOfWeek === near.dayOfWeek);
    const meal = day?.meals.find((candidate) => candidate.mealId === mealId);
    if (meal) {
      return { ...near, meal };
    }
  }
  for (const [weekIndex, week] of doc.weeks.entries()) {
    for (const day of week.days) {
      const meal = day.meals.find((candidate) => candidate.mealId === mealId);
      if (meal) {
        return { weekIndex, dayOfWeek: day.dayOfWeek, meal };
      }
    }
  }
  return null;
}

/**
 * Ties each unreviewed conflict to the editor through the plan's meal locks: a conflict on a live meal is found by
 * the meal's id (so a meal the coach moved still matches); a conflict on an eaten meal that left the plan sits on its
 * stored slot. A conflict no lock points at is only counted by the strip.
 */
export function placeConflicts(
  conflicts: readonly OfflineSyncConflictDto[],
  doc: EditorDocument,
  locks: PlanMealLocks | null,
): PlacedConflict[] {
  const placed: PlacedConflict[] = [];
  for (const conflict of conflicts) {
    const id = conflict.conflictId;
    if (!id) {
      continue;
    }
    const unplaced: PlacedConflict = { id, conflict, weekIndex: null, dayOfWeek: null, meal: undefined, ghost: false };
    const removed = locks?.removed.find((lock) => lock.conflict?.conflictId === id);
    if (removed) {
      const weekIndex = removed.weekNumber - 1;
      placed.push(
        weekIndex >= 0 && weekIndex < doc.weeks.length
          ? { ...unplaced, weekIndex, dayOfWeek: removed.dayOfWeek, ghost: true }
          : unplaced,
      );
      continue;
    }
    const live = locks ? [...locks.meals.values()].find((info) => info.conflict?.conflictId === id) : undefined;
    const position = doc.startDate && conflict.logDate ? planPositionOfDate(doc.startDate, conflict.logDate) : null;
    const near = position && position.weekIndex < doc.weeks.length ? position : null;
    const found = live ? findMeal(doc, live.mealId, near) : null;
    placed.push(found ? { ...unplaced, weekIndex: found.weekIndex, dayOfWeek: found.dayOfWeek, meal: found.meal } : unplaced);
  }
  return placed;
}

/** One ingredient or recipe of a meal. */
export interface CompareLine {
  name: string;
  amount: number;
  unit: 'grams' | 'servings';
  kcal: number;
  /** The item's macros, for the bar beside its kcal. */
  totals: Totals;
}

export type ComparePairStatus = 'same' | 'removed' | 'added' | 'changed';

export interface ComparePair {
  key: string;
  /** The item as the client ate it. */
  saw?: CompareLine;
  /** The item as the coach's plan has it now. */
  now?: CompareLine;
  status: ComparePairStatus;
}

/** One row of the day notice: a plan item, or an eaten item the coach removed. */
export interface PlanRow {
  key: string;
  line: CompareLine;
  status: ComparePairStatus;
}

export interface Comparison {
  pairs: ComparePair[];
  /** The coach's current items first, then the eaten items the coach removed. */
  planRows: PlanRow[];
  /** kcal of what the client ate. */
  sawKcal: number;
  /** kcal of the meal in the coach's plan; zero for a removed meal. */
  nowKcal: number;
}

const TAG_STATUS: Record<MealItemConflictTag, ComparePairStatus> = {
  [MealItemConflictTag.Changed]: 'changed',
  [MealItemConflictTag.Added]: 'added',
  [MealItemConflictTag.Removed]: 'removed',
};

function snapshotLine(item: EatenMealItem): CompareLine {
  return {
    name: item.name ?? '',
    amount: item.amount ?? 0,
    unit: item.kind === SeenMealItemKind.Recipe ? 'servings' : 'grams',
    kcal: item.kcal ?? 0,
    totals: {
      kcal: item.kcal ?? 0,
      protein: item.protein ?? 0,
      carbs: item.carbs ?? 0,
      fat: item.fat ?? 0,
      fiber: item.fibre ?? 0,
    },
  };
}

function liveLines(meal: EditorMeal, language: string): { itemId: string | undefined; line: CompareLine }[] {
  return [
    ...meal.recipes.map((recipe) => {
      const totals = recipeTotals(recipe);
      return {
        itemId: recipe.itemId,
        line: { name: recipe.recipeName, amount: recipe.servings, unit: 'servings' as const, kcal: totals.kcal, totals },
      };
    }),
    ...meal.foods.map((food) => {
      const totals = foodTotals(food);
      return {
        itemId: food.itemId,
        line: {
          name: foodDisplayName(food, language),
          amount: food.amountGrams,
          unit: 'grams' as const,
          kcal: totals.kcal,
          totals,
        },
      };
    }),
  ];
}

/**
 * Sets what the client ate (the snapshot) against the coach's meal, item by item, using the server's per-item tags.
 * Returns null for a lock without a snapshot, which the panels show as text only.
 */
export function buildComparison(
  eaten: EatenView,
  liveMeal: EditorMeal | undefined,
  language: string,
): Comparison | null {
  const snapshot = eaten.snapshot;
  if (snapshot.length === 0) {
    return null;
  }
  const tags = eaten.conflict?.itemTags ?? new Map<string, MealItemConflictTag>();
  const live = liveMeal ? liveLines(liveMeal, language) : [];
  const liveById = new Map(live.flatMap((entry) => (entry.itemId ? [[entry.itemId, entry] as const] : [])));
  const snapshotIds = new Set(snapshot.flatMap((item) => (item.itemId ? [item.itemId] : [])));

  const pairs: ComparePair[] = [];
  const removedRows: PlanRow[] = [];
  snapshot.forEach((item, index) => {
    const saw = snapshotLine(item);
    const match = item.itemId ? liveById.get(item.itemId) : undefined;
    const tag = item.itemId ? tags.get(item.itemId) : undefined;
    const status: ComparePairStatus = tag ? TAG_STATUS[tag] : match ? 'same' : 'removed';
    const key = `${item.itemId ?? 'item'}:${index}`;
    if (status === 'removed' || !match) {
      pairs.push({ key, saw, status: 'removed' });
      removedRows.push({ key: `removed:${key}`, line: saw, status: 'removed' });
      return;
    }
    pairs.push({ key, saw, now: match.line, status });
  });
  const planRows: PlanRow[] = [];
  for (const entry of live) {
    const inSnapshot = entry.itemId !== undefined && snapshotIds.has(entry.itemId);
    const tag = entry.itemId ? tags.get(entry.itemId) : undefined;
    const status: ComparePairStatus = tag && inSnapshot ? TAG_STATUS[tag] : inSnapshot ? 'same' : 'added';
    const key = `${entry.itemId ?? 'new'}:${planRows.length}`;
    planRows.push({ key, line: entry.line, status });
    if (!inSnapshot) {
      pairs.push({ key: `added:${key}`, now: entry.line, status: 'added' });
    }
  }
  return {
    pairs,
    planRows: [...planRows, ...removedRows],
    sawKcal: eatenSnapshotKcal(eaten),
    nowKcal: liveMeal ? mealTotals(liveMeal).kcal : 0,
  };
}

/** What placing a ghost needs: its weekday and meal kind. */
export interface GhostSlot {
  dayOfWeek: number | null;
  kind: MealKind | undefined;
}

export interface GhostExtraRow<T extends GhostSlot> {
  kind: MealKind;
  byDay: Map<number, T>;
}

export interface GhostPlacement<T extends GhostSlot> {
  /** Ghosts that sit in an empty cell of an existing row, keyed `${dayOfWeek}:${rowIndex}`. */
  inRow: Map<string, T>;
  /** Ghosts whose kind has no free cell that day: rows appended after the week's last row. */
  extraRows: GhostExtraRow<T>[];
}

/**
 * Where a week's ghost tiles go: the empty cell of the first row of the ghost's kind on its day; with no
 * such cell, a row appended after the last one.
 */
export function placeGhosts<T extends GhostSlot>(week: EditorWeek, ghosts: readonly T[]): GhostPlacement<T> {
  const rows = weekRows(week);
  const inRow = new Map<string, T>();
  const extraRows: GhostExtraRow<T>[] = [];
  for (const ghost of ghosts) {
    const dayOfWeek = ghost.dayOfWeek;
    const kind = ghost.kind;
    if (dayOfWeek === null || !kind) {
      continue;
    }
    const day = week.days.find((candidate) => candidate.dayOfWeek === dayOfWeek);
    const row = rows.find(
      (candidate) =>
        candidate.kind === kind && !rowMeal(day, candidate) && !inRow.has(`${dayOfWeek}:${candidate.index}`),
    );
    if (row) {
      inRow.set(`${dayOfWeek}:${row.index}`, ghost);
      continue;
    }
    const extra = extraRows.find((candidate) => candidate.kind === kind && !candidate.byDay.has(dayOfWeek));
    if (extra) {
      extra.byDay.set(dayOfWeek, ghost);
    } else {
      extraRows.push({ kind, byDay: new Map([[dayOfWeek, ghost]]) });
    }
  }
  return { inRow, extraRows };
}

/** The local clock time of an ISO instant, e.g. "12:40"; empty for a missing or invalid value. */
export function formatConflictTime(iso: string | undefined, language: string): string {
  const date = iso ? new Date(iso) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })
    : '';
}
