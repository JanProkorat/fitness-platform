import { createContext, useContext } from 'react';
import { MealLockState, type EatenMealItem, type GetPlanResponse } from '@/api/generated';
import type { EditorDocument, EditorMeal } from '@/components/plan-editor/plan-editor-types';

/** What the server says about one stored meal: whether it may change, and what the client ate of it. */
export interface MealLockInfo {
  mealId: string;
  state: MealLockState;
  locked: boolean;
  eatenItemIds: string[];
  /** The items as they stood when first eaten; empty when the meal has no snapshot. */
  snapshot: EatenMealItem[];
  /** When the whole meal was eaten; the server has one time per meal, set only once every item is eaten. */
  eatenAt?: string;
}

/** The lock picture of a client plan, from the plan response the page already holds. */
export interface PlanMealLocks {
  /** The client's calendar date today (YYYY-MM-DD); every day before it is locked. */
  clientToday: string;
  /** The stored start date (YYYY-MM-DD); without one no day is past. */
  startDate: string | undefined;
  clientName: string;
  meals: ReadonlyMap<string, MealLockInfo>;
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

/** Puts the rejected meal back as the server stores it; null when there is nothing to restore or the data is not fresh. */
export const RestoreRejectedContext = createContext<(() => void) | null>(null);

export function useRestoreRejected(): (() => void) | null {
  return useContext(RestoreRejectedContext);
}

export const LockRejectionContext = createContext<LockRejection | null>(null);

export function useLockRejection(): LockRejection | null {
  return useContext(LockRejectionContext);
}

export const MealLocksContext = createContext<PlanMealLocks | null>(null);

export function useMealLocks(): PlanMealLocks | null {
  return useContext(MealLocksContext);
}

/** Reads the server's verdicts; null while the response carries no `clientToday` (nothing is judged then). */
export function buildPlanMealLocks(plan: GetPlanResponse, clientName: string): PlanMealLocks | null {
  if (!plan.clientToday) {
    return null;
  }
  const meals = new Map<string, MealLockInfo>();
  for (const lock of plan.mealLocks ?? []) {
    // A meal the coach removed after the client ate it is not in the plan's weeks; it is handled elsewhere.
    if (!lock.mealId || lock.isRemovedFromPlan) {
      continue;
    }
    const log = (plan.mealLogs ?? []).find(
      (candidate) =>
        candidate.mealId === lock.mealId &&
        (!lock.date || !candidate.logDate || candidate.logDate.slice(0, 10) === lock.date.slice(0, 10)),
    );
    meals.set(lock.mealId, {
      mealId: lock.mealId,
      state: lock.lockState ?? MealLockState.Open,
      locked: lock.isLocked ?? false,
      eatenItemIds: lock.eatenItemIds ?? [],
      snapshot: lock.eatenSnapshot ?? [],
      eatenAt: log?.eatenAt,
    });
  }
  return {
    clientToday: plan.clientToday.slice(0, 10),
    startDate: plan.startDate ? plan.startDate.slice(0, 10) : undefined,
    clientName,
    meals,
  };
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
