import type { QueryClient } from '@tanstack/react-query';

import type { GetTodayLogResponse, NutrientTotals, TodayOffPlanFoodDto } from '@/api/generated';
import { MEASUREMENT_HISTORY_QUERY_KEY } from '@/api/measurements';
import type { MeasurementEntry } from '@/api/measurements';
import { TODAY_LOG_KEY, findMealLog, isMealEaten, withMealEaten } from '@/api/nutrition';
import type { NutritionMeal, ShoppingListData } from '@/api/nutrition';
import { addMacros, macrosOf, scaleMacros } from '@/components/nutrition/meal/format';
import type { Macros } from '@/components/nutrition/meal/format';
import { withItemTicked } from '@/components/nutrition/shopping/model';
import type { MeasurementPayload, OutboxEntry, OutboxWrite } from '@/lib/outbox/types';

// One pure function per kind: it takes cached data and returns it with the write applied. Each is idempotent,
// so running it over data that already holds the change (an optimistic update, or a server copy) changes nothing.

type Payload<K extends OutboxWrite['kind']> = Extract<OutboxWrite, { kind: K }>['payload'];

const asMeal = (mealId: string): NutritionMeal => ({ mealId });

export function applyMealEaten(
  log: GetTodayLogResponse | undefined,
  payload: Payload<'mealEaten'>,
  occurredAt: string,
): GetTodayLogResponse | undefined {
  if (!log || isMealEaten(findMealLog(log, payload.mealId))) return log;
  const next = withMealEaten(log, asMeal(payload.mealId), true);
  return {
    ...next,
    mealsEaten: (next.mealsEaten ?? []).map((row) => (row.mealId === payload.mealId ? { ...row, eatenAt: occurredAt } : row)),
  };
}

export function applyMealUnlogged(
  log: GetTodayLogResponse | undefined,
  payload: Payload<'mealUnlogged'>,
): GetTodayLogResponse | undefined {
  return log ? withMealEaten(log, asMeal(payload.mealId), false) : log;
}

/** Moves the day totals by `delta`; the remaining budget moves the other way. */
function shiftTotals(log: GetTodayLogResponse, delta: Macros, direction: 1 | -1): GetTodayLogResponse {
  const shift = (totals: NutrientTotals | undefined, sign: 1 | -1): NutrientTotals | undefined => {
    if (!totals) return totals;
    const current = macrosOf(totals);
    const moved = addMacros(current, scaleMacros(delta, sign));
    return { ...totals, ...moved };
  };
  return {
    ...log,
    totalConsumed: shift(log.totalConsumed, direction),
    remaining: shift(log.remaining, direction === 1 ? -1 : 1),
  };
}

export function applyOffPlanAdded(
  log: GetTodayLogResponse | undefined,
  payload: Payload<'offPlanAdded'>,
  occurredAt: string,
): GetTodayLogResponse | undefined {
  if (!log) return log;
  const rows = log.offPlanFoods ?? [];
  if (rows.some((row) => row.entryId === payload.entryId)) return log;
  const eaten = scaleMacros(payload.per100, payload.amountGrams / 100);
  const row: TodayOffPlanFoodDto = {
    entryId: payload.entryId,
    foodExternalId: payload.foodExternalId,
    foodName: payload.foodName,
    amountGrams: payload.amountGrams,
    ...eaten,
    loggedAt: occurredAt,
  };
  return shiftTotals({ ...log, offPlanFoods: [...rows, row] }, eaten, 1);
}

export function applyOffPlanRemoved(
  log: GetTodayLogResponse | undefined,
  payload: Payload<'offPlanRemoved'>,
): GetTodayLogResponse | undefined {
  if (!log) return log;
  const rows = log.offPlanFoods ?? [];
  const row = rows.find((candidate) => candidate.entryId === payload.entryId);
  if (!row) return log;
  return shiftTotals({ ...log, offPlanFoods: rows.filter((candidate) => candidate !== row) }, macrosOf(row), -1);
}

export function applyShoppingTicked(
  data: ShoppingListData | undefined,
  payload: Payload<'shoppingTicked'>,
): ShoppingListData | undefined {
  return withItemTicked(data, payload.foodExternalId, payload.isTicked);
}

export function applyMeasurementAdded(
  history: MeasurementEntry[] | undefined,
  payload: MeasurementPayload,
): MeasurementEntry[] | undefined {
  if (!history) return history;
  const at = Date.parse(payload.measuredAt);
  if (Number.isNaN(at) || history.some((row) => row.at === at)) return history;
  const row: MeasurementEntry = { ...payload, measurementId: `pending:${payload.measuredAt}`, at };
  return [...history, row].sort((first, second) => second.at - first.at);
}

const isLocalToday = (iso: string): boolean => new Date(iso).toDateString() === new Date().toDateString();

/** The day log only holds today, so an entry from another day never touches it. */
export function applyToTodayLog(
  log: GetTodayLogResponse | undefined,
  entries: readonly OutboxEntry[],
): GetTodayLogResponse | undefined {
  let next = log;
  for (const entry of entries) {
    if (!isLocalToday(entry.occurredAt)) continue;
    switch (entry.kind) {
      case 'mealEaten':
        next = applyMealEaten(next, entry.payload, entry.occurredAt);
        break;
      case 'mealUnlogged':
        next = applyMealUnlogged(next, entry.payload);
        break;
      case 'offPlanAdded':
        next = applyOffPlanAdded(next, entry.payload, entry.occurredAt);
        break;
      case 'offPlanRemoved':
        next = applyOffPlanRemoved(next, entry.payload);
        break;
      default:
        break;
    }
  }
  return next;
}

export function applyToShoppingList(
  data: ShoppingListData | undefined,
  entries: readonly OutboxEntry[],
  weekNumber: number,
): ShoppingListData | undefined {
  let next = data;
  for (const entry of entries) {
    if (entry.kind === 'shoppingTicked' && entry.payload.weekNumber === weekNumber) {
      next = applyShoppingTicked(next, entry.payload);
    }
  }
  return next;
}

export function applyToMeasurementHistory(
  history: MeasurementEntry[] | undefined,
  entries: readonly OutboxEntry[],
): MeasurementEntry[] | undefined {
  let next = history;
  for (const entry of entries) {
    if (entry.kind === 'measurementAdded') next = applyMeasurementAdded(next, entry.payload);
  }
  return next;
}

const sameKey = (first: readonly unknown[], second: readonly unknown[]): boolean =>
  first.length === second.length && first.every((part, index) => part === second[index]);

const SHOPPING_LIST_PREFIX = ['nutrition', 'shoppingList'] as const;

/** Week of a cached single-week shopping list key, or null for any other key. */
function shoppingWeekOf(queryKey: readonly unknown[]): number | null {
  const [root, second, from, to] = queryKey;
  if (root !== SHOPPING_LIST_PREFIX[0] || second !== SHOPPING_LIST_PREFIX[1]) return null;
  return typeof from === 'number' && from === to ? from : null;
}

/**
 * Puts the pending writes back on top of a query that was just refetched, so the refetch does not undo them.
 * Keys the outbox does not touch are left alone.
 */
export function reapplyPending(client: QueryClient, queryKey: readonly unknown[], entries: readonly OutboxEntry[]): void {
  if (entries.length === 0) return;
  if (sameKey(queryKey, TODAY_LOG_KEY)) {
    client.setQueryData<GetTodayLogResponse>(TODAY_LOG_KEY, (log) => applyToTodayLog(log, entries));
    return;
  }
  if (sameKey(queryKey, MEASUREMENT_HISTORY_QUERY_KEY)) {
    client.setQueryData<MeasurementEntry[]>(MEASUREMENT_HISTORY_QUERY_KEY, (history) =>
      applyToMeasurementHistory(history, entries),
    );
    return;
  }
  const week = shoppingWeekOf(queryKey);
  if (week !== null) {
    client.setQueryData<ShoppingListData>(queryKey, (data) => applyToShoppingList(data, entries, week));
  }
}

/** Re-applies the pending writes to every cached query they can affect. */
export function reapplyAllPending(client: QueryClient, entries: readonly OutboxEntry[]): void {
  reapplyPending(client, TODAY_LOG_KEY, entries);
  reapplyPending(client, MEASUREMENT_HISTORY_QUERY_KEY, entries);
  for (const query of client.getQueryCache().findAll({ queryKey: SHOPPING_LIST_PREFIX })) {
    reapplyPending(client, query.queryKey, entries);
  }
}
