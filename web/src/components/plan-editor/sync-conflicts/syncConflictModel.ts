import {
  OfflineSyncConflictKind,
  SeenMealItemKind,
  type MealKind,
  type OfflineSyncConflictDto,
  type SeenMealItemDto,
} from '@/api/generated';
import { planPositionOfDate } from '@/components/client-plan-editor/clientPlanDates';
import { foodDisplayName } from '@/components/plan-editor/plan-editor-library';
import { foodTotals, mealTotals, recipeTotals } from '@/components/plan-editor/plan-editor-nutrition';
import { rowMeal, weekRows } from '@/components/plan-editor/plan-editor-ops';
import type { EditorDocument, EditorMeal, EditorWeek } from '@/components/plan-editor/plan-editor-types';

/** An unreviewed conflict tied to the place it shows in the editor. */
export interface PlacedConflict {
  id: string;
  conflict: OfflineSyncConflictDto;
  /** The week and weekday it shows on; null when the day lies outside the plan, so only the strip counts it. */
  weekIndex: number | null;
  dayOfWeek: number | null;
  /** The meal as the plan holds it now; undefined for a meal that has left the plan (a ghost). */
  meal: EditorMeal | undefined;
  ghost: boolean;
}

const AMOUNT_EPSILON = 0.01;

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
 * Ties each conflict to the editor. A changed meal is found by its id in the live document, so a meal the
 * coach moved still matches; a removed meal (or a changed one that is gone) becomes a ghost on its logged day.
 */
export function placeConflicts(conflicts: readonly OfflineSyncConflictDto[], doc: EditorDocument): PlacedConflict[] {
  const placed: PlacedConflict[] = [];
  for (const conflict of conflicts) {
    if (!conflict.conflictId) {
      continue;
    }
    const position = doc.startDate && conflict.logDate ? planPositionOfDate(doc.startDate, conflict.logDate) : null;
    const logged = position && position.weekIndex < doc.weeks.length ? position : null;
    if (conflict.kind !== OfflineSyncConflictKind.MealRemoved && conflict.mealId) {
      const found = findMeal(doc, conflict.mealId, logged);
      if (found) {
        placed.push({
          id: conflict.conflictId,
          conflict,
          weekIndex: found.weekIndex,
          dayOfWeek: found.dayOfWeek,
          meal: found.meal,
          ghost: false,
        });
        continue;
      }
    }
    placed.push({
      id: conflict.conflictId,
      conflict,
      weekIndex: logged?.weekIndex ?? null,
      dayOfWeek: logged?.dayOfWeek ?? null,
      meal: undefined,
      ghost: logged !== null,
    });
  }
  return placed;
}

/** One ingredient or recipe of a meal. */
export interface CompareLine {
  name: string;
  amount: number;
  unit: 'grams' | 'servings';
  kcal: number;
}

export type ComparePairStatus = 'same' | 'removed' | 'added' | 'amount';

export interface ComparePair {
  key: string;
  saw?: CompareLine;
  now?: CompareLine;
  status: ComparePairStatus;
}

export interface Comparison {
  pairs: ComparePair[];
  sawKcal: number;
  nowKcal: number;
}

function seenKey(item: SeenMealItemDto): string {
  return `${item.kind === SeenMealItemKind.Recipe ? 'recipe' : 'food'}:${(item.refId ?? '').toLowerCase()}`;
}

function liveLines(meal: EditorMeal, language: string): { key: string; line: CompareLine }[] {
  return [
    ...meal.recipes.map((recipe) => ({
      key: `recipe:${recipe.recipeId.toLowerCase()}`,
      line: {
        name: recipe.recipeName,
        amount: recipe.servings,
        unit: 'servings' as const,
        kcal: recipeTotals(recipe).kcal,
      },
    })),
    ...meal.foods.map((food) => ({
      key: `food:${food.foodExternalId.toLowerCase()}`,
      line: {
        name: foodDisplayName(food, language),
        amount: food.amountGrams,
        unit: 'grams' as const,
        kcal: foodTotals(food).kcal,
      },
    })),
  ];
}

/**
 * Pairs what the client saw with the meal as it is now. Returns null for a conflict without seen items
 * (older conflicts), which the panels show as text only.
 */
export function compareConflict(
  conflict: OfflineSyncConflictDto,
  liveMeal: EditorMeal | undefined,
  language: string,
): Comparison | null {
  const seen = conflict.seenItems ?? [];
  if (seen.length === 0) {
    return null;
  }
  const live = liveMeal ? liveLines(liveMeal, language) : [];
  const unmatched = new Map<string, CompareLine[]>();
  for (const { key, line } of live) {
    unmatched.set(key, [...(unmatched.get(key) ?? []), line]);
  }
  const pairs: ComparePair[] = [];
  seen.forEach((item, index) => {
    const key = seenKey(item);
    const saw: CompareLine = {
      name: item.name ?? '',
      amount: item.amount ?? 0,
      unit: item.kind === SeenMealItemKind.Recipe ? 'servings' : 'grams',
      kcal: item.kcal ?? 0,
    };
    const now = unmatched.get(key)?.shift();
    if (!now) {
      pairs.push({ key: `${key}:${index}`, saw, status: 'removed' });
      return;
    }
    pairs.push({
      key: `${key}:${index}`,
      saw,
      now,
      status: Math.abs(saw.amount - now.amount) > AMOUNT_EPSILON ? 'amount' : 'same',
    });
  });
  for (const { key, line } of live) {
    const remaining = unmatched.get(key);
    if (remaining?.includes(line)) {
      remaining.splice(remaining.indexOf(line), 1);
      pairs.push({ key: `${key}:added:${pairs.length}`, now: line, status: 'added' });
    }
  }
  return {
    pairs,
    sawKcal: seen.reduce((sum, item) => sum + (item.kcal ?? 0), 0),
    nowKcal: liveMeal ? mealTotals(liveMeal).kcal : 0,
  };
}

export interface GhostExtraRow {
  kind: MealKind;
  byDay: Map<number, PlacedConflict>;
}

export interface GhostPlacement {
  /** Ghosts that sit in an empty cell of an existing row, keyed `${dayOfWeek}:${rowIndex}`. */
  inRow: Map<string, PlacedConflict>;
  /** Ghosts whose kind has no free cell that day: rows appended after the week's last row. */
  extraRows: GhostExtraRow[];
}

/**
 * Where a week's ghost tiles go: the empty cell of the first row of the ghost's kind on its day; with no
 * such cell, a row appended after the last one.
 */
export function placeGhosts(week: EditorWeek, ghosts: readonly PlacedConflict[]): GhostPlacement {
  const rows = weekRows(week);
  const inRow = new Map<string, PlacedConflict>();
  const extraRows: GhostExtraRow[] = [];
  for (const ghost of ghosts) {
    const dayOfWeek = ghost.dayOfWeek;
    const kind = ghost.conflict.mealKind;
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
