import { OfflineSyncConflictKind } from '@/api/generated';
import type { GetTodayLogResponse, LogMealEatenResponse } from '@/api/generated';
import { FULL_PLAN_KEY, TODAY_LOG_KEY, TODAY_PLAN_KEY, WEEK_PLAN_KEY } from '@/api/nutrition';
import type { ShoppingListData } from '@/api/nutrition';
import { foodName } from '@/components/nutrition/meal/format';
import i18n from '@/i18n';
import { queryClient } from '@/lib/queryClient';
import type { EntryLabel, OutboxEntry, SyncConflictKind } from '@/lib/outbox/types';
import { useOutboxStore } from '@/stores/outbox';

const MAX_DEPTH = 8;

/** Looks for the plan meal with this id anywhere inside a cached plan response and returns its kind. */
function mealKindIn(node: unknown, mealId: string, depth = 0): string | undefined {
  if (depth > MAX_DEPTH || typeof node !== 'object' || node === null) return undefined;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = mealKindIn(item, mealId, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const record = node as Record<string, unknown>;
  if (record.mealId === mealId && typeof record.kind === 'string') return record.kind;
  for (const value of Object.values(record)) {
    const found = mealKindIn(value, mealId, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

function mealKindOf(mealId: string): string | undefined {
  for (const queryKey of [TODAY_PLAN_KEY, WEEK_PLAN_KEY, FULL_PLAN_KEY]) {
    for (const query of queryClient.getQueryCache().findAll({ queryKey })) {
      const found = mealKindIn(query.state.data, mealId);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function shoppingNameOf(foodExternalId: string): string | undefined {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: ['nutrition', 'shoppingList'] })) {
    const item = (query.state.data as ShoppingListData | undefined)?.items?.find(
      (candidate) => candidate.foodExternalId === foodExternalId,
    );
    if (item) return foodName(item, i18n.language) || undefined;
  }
  return undefined;
}

/**
 * What a note about this entry should name. Read before any refetch, since a meal the coach removed leaves
 * the cached plan as soon as it is refreshed.
 */
export function describeEntry(entry: OutboxEntry): EntryLabel {
  const date = entry.occurredAt;
  switch (entry.kind) {
    case 'mealEaten':
    case 'mealUnlogged':
      return { mealKind: mealKindOf(entry.payload.mealId), date };
    case 'offPlanAdded':
      return { name: entry.payload.foodName || undefined, date };
    case 'offPlanRemoved': {
      const log = queryClient.getQueryData<GetTodayLogResponse>(TODAY_LOG_KEY);
      const row = log?.offPlanFoods?.find((candidate) => candidate.entryId === entry.payload.entryId);
      return { name: row?.foodName || undefined, date };
    }
    case 'shoppingTicked':
      return { name: shoppingNameOf(entry.payload.foodExternalId), date };
    case 'measurementAdded':
      return { date: entry.payload.measuredAt };
  }
}

const conflictKindOf = (kind: OfflineSyncConflictKind | undefined): SyncConflictKind =>
  kind === OfflineSyncConflictKind.MealRemoved ? 'mealRemoved' : 'planChanged';

/** Records a conflict when the server's answer to a logged meal says it collided with a plan change. */
export async function recordSyncOutcome(entry: OutboxEntry, response: LogMealEatenResponse | undefined): Promise<void> {
  if (entry.kind !== 'mealEaten' || response?.syncConflict !== true) return;
  await useOutboxStore.getState().addSyncConflict({
    id: entry.id,
    kind: conflictKindOf(response.syncConflictKind),
    mealId: entry.payload.mealId,
    label: describeEntry(entry),
    at: new Date().toISOString(),
  });
}
