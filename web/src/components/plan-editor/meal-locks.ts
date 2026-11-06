import { createContext, useContext } from 'react';
import {
  MealLockState,
  type EatenMealItem,
  type GetPlanResponse,
  type MealItemConflictTag,
  type MealKind,
  type MealLockConflictDto,
  type OfflineSyncConflictKind,
} from '@/api/generated';
import { foodTotals, recipeTotals, type MealItemEntry, type Totals } from '@/components/plan-editor/plan-editor-nutrition';
import type { EditorDocument, EditorMeal } from '@/components/plan-editor/plan-editor-types';

/** The offline-sync conflict behind a locked meal, as the plan response carries it. */
export interface MealLockConflict {
  conflictId: string;
  kind: OfflineSyncConflictKind | undefined;
  basedOnPlanVersion: number | undefined;
  currentPlanVersion: number | undefined;
  /** How each differing item (by plan item id) differs between what the client ate and the coach's meal. */
  itemTags: ReadonlyMap<string, MealItemConflictTag>;
}

/** What the client ate of one meal: the snapshot, the eaten items and the conflict behind it, if any. */
export interface EatenView {
  /** The items as they stood when first eaten; empty when the meal has no snapshot. */
  snapshot: EatenMealItem[];
  eatenItemIds: string[];
  /** When the whole meal was eaten; the server has one time per meal, set only once every item is eaten. */
  eatenAt?: string;
  conflict?: MealLockConflict;
}

/** What the server says about one stored meal: whether it may change, and what the client ate of it. */
export interface MealLockInfo extends EatenView {
  mealId: string;
  state: MealLockState;
  locked: boolean;
}

/** A meal the client ate that the coach has since removed from the plan. It is never part of the document. */
export interface RemovedEatenMeal extends EatenView {
  mealId: string;
  /** 1-based week number of the slot it sat in. */
  weekNumber: number;
  /** 1 to 7, Monday = 1. */
  dayOfWeek: number;
  kind: MealKind;
}

/** The lock picture of a client plan, from the plan response the page already holds. */
export interface PlanMealLocks {
  /** The client's calendar date today (YYYY-MM-DD); every day before it is locked. */
  clientToday: string;
  /** The stored start date (YYYY-MM-DD); without one no day is past. */
  startDate: string | undefined;
  clientName: string;
  meals: ReadonlyMap<string, MealLockInfo>;
  /** Eaten meals that left the plan; the editor shows them read-only where they sat. */
  removed: readonly RemovedEatenMeal[];
}

/** What a slot's cell, popover and drag rules need to know about one meal. */
export interface MealLockView {
  state: MealLockState;
  locked: boolean;
  info: MealLockInfo | undefined;
}

/** The surface of a locked tile: tinted by what the client did with the meal. */
export function lockedTileSurfaceClass(state: MealLockState): string {
  switch (state) {
    case MealLockState.Eaten:
      return 'border-success-ink/30 bg-success-soft shadow-none';
    case MealLockState.PartlyEaten:
      return 'border-caution-ink/40 bg-caution-soft shadow-none';
    case MealLockState.Missed:
      return 'border-error/30 bg-error-soft shadow-none';
    default:
      return 'border-line bg-muted shadow-none';
  }
}

/** The tile the server named when it refused a save with MEAL_LOCKED or PAST_DAY_LOCKED. */
export interface LockRejection {
  /** Null only when a meal added to a past day carried no id; the day is outlined then. */
  mealId: string | null;
  weekNumber: number;
  /** 1 to 7, Monday = 1. */
  dayOfWeek: number;
}

/** Reads the lock 409's extension members from a ProblemDetails body; null when they are missing or malformed. */
export function parseLockRejection(body: Record<string, unknown> | null): LockRejection | null {
  if (!body) {
    return null;
  }
  const { mealId, weekNumber, dayOfWeek } = body;
  if (
    typeof weekNumber !== 'number' ||
    typeof dayOfWeek !== 'number' ||
    !Number.isInteger(weekNumber) ||
    !Number.isInteger(dayOfWeek) ||
    dayOfWeek < 1 ||
    dayOfWeek > 7
  ) {
    return null;
  }
  if (mealId !== null && mealId !== undefined && typeof mealId !== 'string') {
    return null;
  }
  return { mealId: mealId ?? null, weekNumber, dayOfWeek };
}

/** Whether a tile (identified by its meal, week number and weekday) is the rejected one. */
export function isRejectedTile(
  rejection: LockRejection | null,
  mealId: string | undefined,
  weekNumber: number,
  dayOfWeek: number,
): boolean {
  if (!rejection) {
    return false;
  }
  if (rejection.mealId !== null) {
    return mealId === rejection.mealId;
  }
  return mealId !== undefined && rejection.weekNumber === weekNumber && rejection.dayOfWeek === dayOfWeek;
}

/**
 * What an edit of the rejected meal changes: the meal object (a new one after every edit) and where it sits.
 * Two fingerprints differ exactly when the coach touched that meal, moved it or deleted it.
 */
export function rejectionFingerprint(doc: EditorDocument, rejection: LockRejection): readonly unknown[] {
  if (rejection.mealId === null) {
    const day = doc.weeks
      .find((week) => week.weekNumber === rejection.weekNumber)
      ?.days.find((candidate) => candidate.dayOfWeek === rejection.dayOfWeek);
    return [day?.meals];
  }
  for (const week of doc.weeks) {
    for (const day of week.days) {
      const meal = day.meals.find((candidate) => candidate.mealId === rejection.mealId);
      if (meal) {
        return [meal, week.weekNumber, day.dayOfWeek];
      }
    }
  }
  return [undefined];
}

export function sameFingerprint(left: readonly unknown[], right: readonly unknown[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/** The server's stored copy of a meal with the week and day it is stored in. */
export interface StoredMeal {
  meal: EditorMeal;
  weekNumber: number;
  dayOfWeek: number;
}

/** Finds a meal in the server's document; undefined when it is not there. */
export function findStoredMeal(stored: EditorDocument, mealId: string): StoredMeal | undefined {
  for (const week of stored.weeks) {
    for (const day of week.days) {
      const meal = day.meals.find((candidate) => candidate.mealId === mealId);
      if (meal) {
        return { meal, weekNumber: week.weekNumber, dayOfWeek: day.dayOfWeek };
      }
    }
  }
  return undefined;
}

/** Puts one flagged meal back as the server stores it; null when the server's copy is not fresh (a refetch is under way). */
export const RestoreRejectedContext = createContext<((mealId: string) => void) | null>(null);

export function useRestoreRejected(): ((mealId: string) => void) | null {
  return useContext(RestoreRejectedContext);
}

/** Why a meal can no longer be saved: the client ate it, or it sits on a day that is over. */
export type LockConflictKind = 'eaten' | 'pastDay';

/** The meals whose unsaved draft clashes with a lock, by meal id. */
export const LockConflictsContext = createContext<ReadonlyMap<string, LockConflictKind>>(new Map());

export function useLockConflicts(): ReadonlyMap<string, LockConflictKind> {
  return useContext(LockConflictsContext);
}

/**
 * Finds the draft meals that cannot be saved: locked per the live `locks` while the draft differs from the server's
 * stored copy, or added to a past day. "Differs" is the editor's own dirty test (JSON of the meal) plus its place.
 */
export function findLockConflicts(
  doc: EditorDocument,
  stored: EditorDocument | null,
  locks: PlanMealLocks | null,
): Map<string, LockConflictKind> {
  const found = new Map<string, LockConflictKind>();
  if (!stored || !locks) {
    return found;
  }
  for (const week of doc.weeks) {
    for (const day of week.days) {
      for (const meal of day.meals) {
        const view = mealLockView(locks, meal.mealId, week.weekNumber, day.dayOfWeek);
        if (!view.locked) {
          continue;
        }
        const counterpart = findStoredMeal(stored, meal.mealId);
        const changed =
          !counterpart ||
          counterpart.weekNumber !== week.weekNumber ||
          counterpart.dayOfWeek !== day.dayOfWeek ||
          JSON.stringify(counterpart.meal) !== JSON.stringify(meal);
        if (changed) {
          found.set(meal.mealId, counterpart && view.info?.locked ? 'eaten' : 'pastDay');
        }
      }
    }
  }
  return found;
}

export const LockRejectionContext = createContext<LockRejection | null>(null);

export function useLockRejection(): LockRejection | null {
  return useContext(LockRejectionContext);
}

export const MealLocksContext = createContext<PlanMealLocks | null>(null);

export function useMealLocks(): PlanMealLocks | null {
  return useContext(MealLocksContext);
}

function toLockConflict(conflict: MealLockConflictDto | undefined): MealLockConflict | undefined {
  if (!conflict?.conflictId) {
    return undefined;
  }
  const itemTags = new Map<string, MealItemConflictTag>();
  for (const entry of conflict.itemTags ?? []) {
    if (entry.itemId && entry.tag) {
      itemTags.set(entry.itemId, entry.tag);
    }
  }
  return {
    conflictId: conflict.conflictId,
    kind: conflict.kind,
    basedOnPlanVersion: conflict.basedOnPlanVersion,
    currentPlanVersion: conflict.currentPlanVersion,
    itemTags,
  };
}

/** Reads the server's verdicts; null while the response carries no `clientToday` (nothing is judged then). */
export function buildPlanMealLocks(plan: GetPlanResponse, clientName: string): PlanMealLocks | null {
  if (!plan.clientToday) {
    return null;
  }
  const meals = new Map<string, MealLockInfo>();
  const removed: RemovedEatenMeal[] = [];
  for (const lock of plan.mealLocks ?? []) {
    if (!lock.mealId) {
      continue;
    }
    const log = (plan.mealLogs ?? []).find(
      (candidate) =>
        candidate.mealId === lock.mealId &&
        (!lock.date || !candidate.logDate || candidate.logDate.slice(0, 10) === lock.date.slice(0, 10)),
    );
    const eaten: EatenView = {
      eatenItemIds: lock.eatenItemIds ?? [],
      snapshot: lock.eatenSnapshot ?? [],
      eatenAt: log?.eatenAt,
      conflict: toLockConflict(lock.conflict),
    };
    if (lock.isRemovedFromPlan) {
      // A meal the coach removed after the client ate it is not in the plan's weeks; it is placed by its slot.
      if (lock.weekNumber !== undefined && lock.dayOfWeek !== undefined && lock.mealKind) {
        removed.push({ ...eaten, mealId: lock.mealId, weekNumber: lock.weekNumber, dayOfWeek: lock.dayOfWeek, kind: lock.mealKind });
      }
      continue;
    }
    meals.set(lock.mealId, {
      ...eaten,
      mealId: lock.mealId,
      state: lock.lockState ?? MealLockState.Open,
      locked: lock.isLocked ?? false,
    });
  }
  return {
    clientToday: plan.clientToday.slice(0, 10),
    startDate: plan.startDate ? plan.startDate.slice(0, 10) : undefined,
    clientName,
    meals,
    removed,
  };
}

/** One eaten-but-removed meal placed in a week, ready to draw as a read-only tile or card. */
export interface RemovedGhost {
  /** The conflict's id when the meal has one (so "Show" can address it), otherwise a stable id of its own. */
  id: string;
  lock: RemovedEatenMeal;
  weekIndex: number;
  dayOfWeek: number;
  kind: MealKind;
}

/** The removed-but-eaten meals of a week (zero-based index), optionally of one weekday. */
export function removedGhosts(locks: PlanMealLocks, weekIndex: number, dayOfWeek?: number): RemovedGhost[] {
  return locks.removed
    .filter((lock) => lock.weekNumber - 1 === weekIndex && (dayOfWeek === undefined || lock.dayOfWeek === dayOfWeek))
    .map((lock) => ({
      id: lock.conflict?.conflictId ?? `removed:${lock.mealId}`,
      lock,
      weekIndex,
      dayOfWeek: lock.dayOfWeek,
      kind: lock.kind,
    }));
}

/** One row of a locked meal's card: the item and whether the client ate it. */
export interface LockedEntry {
  entry: MealItemEntry;
  eaten: boolean;
  /** Library id of the food or recipe, for the info popover. */
  sourceId: string | undefined;
}

/** The snapshot's items as card rows; `index` runs across the whole snapshot so every row has its own. */
export function snapshotEntries(snapshot: readonly EatenMealItem[], eatenItemIds: readonly string[]): LockedEntry[] {
  const ids = new Set(eatenItemIds);
  return snapshot.map((item, index) => ({
    entry: {
      type: item.kind === 'Recipe' ? 'recipe' : 'food',
      index,
      name: item.name ?? '',
      amount: item.amount ?? 0,
      totals: {
        kcal: item.kcal ?? 0,
        protein: item.protein ?? 0,
        carbs: item.carbs ?? 0,
        fat: item.fat ?? 0,
        fiber: item.fibre ?? 0,
      },
    },
    eaten: item.itemId !== undefined && ids.has(item.itemId),
    sourceId: item.refId,
  }));
}

/** Sums a locked card's rows. */
export function sumEntries(rows: readonly LockedEntry[]): Totals {
  return rows.reduce<Totals>(
    (sum, row) => ({
      kcal: sum.kcal + row.entry.totals.kcal,
      protein: sum.protein + row.entry.totals.protein,
      carbs: sum.carbs + row.entry.totals.carbs,
      fat: sum.fat + row.entry.totals.fat,
      fiber: sum.fiber + row.entry.totals.fiber,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );
}

/** Eaten when every snapshot item was ticked (or none are listed), otherwise partly eaten. */
export function eatenViewState(eaten: EatenView): MealLockState {
  const ids = new Set(eaten.eatenItemIds);
  const all = ids.size === 0 || eaten.snapshot.every((item) => item.itemId !== undefined && ids.has(item.itemId));
  return all ? MealLockState.Eaten : MealLockState.PartlyEaten;
}

/** kcal of the snapshot items the client ate; every item counts when the lock lists none as eaten. */
export function eatenSnapshotKcal(eaten: EatenView): number {
  const ids = new Set(eaten.eatenItemIds);
  return eaten.snapshot
    .filter((item) => ids.size === 0 || (item.itemId !== undefined && ids.has(item.itemId)))
    .reduce((sum, item) => sum + (item.kcal ?? 0), 0);
}

/** kcal of the plan meal's own items the client ate, for a lock that kept no snapshot. */
function eatenPlanMealKcal(meal: EditorMeal, eatenItemIds: readonly string[]): number {
  const ids = new Set(eatenItemIds);
  let kcal = 0;
  for (const food of meal.foods) {
    kcal += food.itemId !== undefined && ids.has(food.itemId) ? foodTotals(food).kcal : 0;
  }
  for (const recipe of meal.recipes) {
    kcal += recipe.itemId !== undefined && ids.has(recipe.itemId) ? recipeTotals(recipe).kcal : 0;
  }
  return kcal;
}

/**
 * What the client ate on one day, in kcal: the snapshot items they ticked (the plan meal's items for a lock without
 * a snapshot), removed-from-plan meals included. Never read from the meal log.
 */
export function dayEatenKcal(
  locks: PlanMealLocks,
  weekNumber: number,
  dayOfWeek: number,
  meals: readonly EditorMeal[],
): number {
  let kcal = 0;
  for (const meal of meals) {
    const info = locks.meals.get(meal.mealId);
    if (!info || info.eatenItemIds.length === 0) {
      continue;
    }
    kcal += info.snapshot.length > 0 ? eatenSnapshotKcal(info) : eatenPlanMealKcal(meal, info.eatenItemIds);
  }
  for (const lock of locks.removed) {
    if (lock.weekNumber === weekNumber && lock.dayOfWeek === dayOfWeek) {
      kcal += eatenSnapshotKcal(lock);
    }
  }
  return Math.round(kcal);
}

/** The calendar date (YYYY-MM-DD) of a week's weekday; null when the plan has no start date. */
export function slotDate(startDate: string | undefined, weekNumber: number, dayOfWeek: number): string | null {
  if (!startDate) {
    return null;
  }
  const [year, month, day] = startDate.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }
  const offset = (weekNumber - 1) * 7 + (dayOfWeek - 1);
  return new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
}

export function isPastDay(locks: PlanMealLocks, weekNumber: number, dayOfWeek: number): boolean {
  const date = slotDate(locks.startDate, weekNumber, dayOfWeek);
  return date !== null && date < locks.clientToday;
}

export function isToday(locks: PlanMealLocks, weekNumber: number, dayOfWeek: number): boolean {
  return slotDate(locks.startDate, weekNumber, dayOfWeek) === locks.clientToday;
}

/** One meal's verdict: the server's, or "missed and locked" for a meal on a past day the server has not listed yet. */
export function mealLockView(locks: PlanMealLocks, mealId: string, weekNumber: number, dayOfWeek: number): MealLockView {
  const info = locks.meals.get(mealId);
  const past = isPastDay(locks, weekNumber, dayOfWeek);
  return {
    info,
    state: info?.state ?? (past ? MealLockState.Missed : MealLockState.Open),
    locked: (info?.locked ?? false) || past,
  };
}

/** True when the day is past or holds a meal that may not change. */
export function dayHasLock(
  locks: PlanMealLocks,
  weekNumber: number,
  dayOfWeek: number,
  meals: readonly EditorMeal[],
): boolean {
  return isPastDay(locks, weekNumber, dayOfWeek) || meals.some((meal) => locks.meals.get(meal.mealId)?.locked === true);
}

/**
 * Puts every locked meal and every past day's meals back as they were in `previous`, whatever `next` did to them.
 * The server refuses such edits with a 409; this keeps the browser's document from ever holding one.
 */
export function keepLocked(
  locks: PlanMealLocks,
  next: EditorDocument,
  previous: EditorDocument,
  /** The one meal a restore of the server's stored copy may change; every other meal stays guarded. */
  restoredMealId?: string,
): EditorDocument {
  if (next === previous) {
    return next;
  }
  const weeks = next.weeks.map((nextWeek) => {
    const previousWeek = previous.weeks.find((candidate) => candidate.weekNumber === nextWeek.weekNumber);
    if (!previousWeek) {
      return nextWeek;
    }
    const days = nextWeek.days.map((nextDay) => {
      const previousDay = previousWeek.days.find((candidate) => candidate.dayOfWeek === nextDay.dayOfWeek);
      if (!previousDay) {
        return nextDay;
      }
      if (isPastDay(locks, nextWeek.weekNumber, nextDay.dayOfWeek)) {
        if (nextDay.meals === previousDay.meals) {
          return nextDay;
        }
        if (restoredMealId === undefined) {
          return { ...nextDay, meals: previousDay.meals };
        }
        // Past day: everything reverts except the restored meal, which takes the restore's version (or goes away).
        const incoming = nextDay.meals.find((meal) => meal.mealId === restoredMealId);
        const kept = previousDay.meals.flatMap((meal) =>
          meal.mealId !== restoredMealId ? [meal] : incoming ? [incoming] : [],
        );
        const meals =
          incoming && !previousDay.meals.some((meal) => meal.mealId === restoredMealId)
            ? [...kept.slice(0, Math.max(incoming.order - 1, 0)), incoming, ...kept.slice(Math.max(incoming.order - 1, 0))]
            : kept;
        return { ...nextDay, meals };
      }
      const lockedBefore = previousDay.meals.filter(
        (meal) => meal.mealId !== restoredMealId && locks.meals.get(meal.mealId)?.locked === true,
      );
      if (lockedBefore.length === 0) {
        return nextDay;
      }
      const lockedById = new Map(lockedBefore.map((meal) => [meal.mealId, meal]));
      const meals = nextDay.meals.map((meal) => lockedById.get(meal.mealId) ?? meal);
      for (const locked of lockedBefore) {
        if (!meals.some((meal) => meal.mealId === locked.mealId)) {
          meals.splice(Math.min(previousDay.meals.indexOf(locked), meals.length), 0, locked);
        }
      }
      const unchanged = meals.length === nextDay.meals.length && meals.every((meal, index) => meal === nextDay.meals[index]);
      return unchanged ? nextDay : { ...nextDay, meals };
    });
    return days.every((day, index) => day === nextWeek.days[index]) ? nextWeek : { ...nextWeek, days };
  });
  return weeks.every((week, index) => week === next.weeks[index]) ? next : { ...next, weeks };
}
