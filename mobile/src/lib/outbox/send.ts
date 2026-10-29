import type { QueryKey } from '@tanstack/react-query';

import { api } from '@/api/client';
import type { LogMealEatenResponse } from '@/api/generated';
import { MEASUREMENTS_QUERY_KEY } from '@/api/measurements';
import { FULL_PLAN_KEY, TODAY_LOG_KEY, TODAY_PLAN_KEY, WEEK_LOG_KEY } from '@/api/nutrition';
import { PROFILE_SUMMARY_QUERY_KEY } from '@/api/profile';
import type { OutboxEntry, OutboxKind } from '@/lib/outbox/types';

/**
 * Sends one entry with its replay metadata; the same entry sent twice applies once on the server.
 * Resolves with the server's answer for a logged meal, which says whether it collided with a plan change.
 */
export async function sendEntry(entry: OutboxEntry): Promise<LogMealEatenResponse | undefined> {
  const basedOnPlanVersion = entry.basedOnPlanVersion ?? undefined;
  switch (entry.kind) {
    case 'mealEaten':
      return api.logMealEatenEndpoint(entry.payload.mealId, {
        occurredAt: entry.occurredAt,
        clientRequestId: entry.id,
        basedOnPlanVersion,
      });
    case 'mealUnlogged':
      await api.unlogMealEatenEndpoint(entry.payload.mealId, entry.occurredAt, entry.id, basedOnPlanVersion);
      return undefined;
    case 'offPlanAdded':
      await api.addOffPlanFoodEndpoint({
        foodExternalId: entry.payload.foodExternalId,
        amountGrams: entry.payload.amountGrams,
        entryId: entry.payload.entryId,
        occurredAt: entry.occurredAt,
        clientRequestId: entry.id,
        basedOnPlanVersion,
      });
      return undefined;
    case 'offPlanRemoved':
      await api.removeOffPlanFoodEndpoint(entry.payload.entryId, entry.occurredAt, entry.id, basedOnPlanVersion);
      return undefined;
    case 'shoppingTicked':
      await api.setShoppingListItemTickedEndpoint({
        weekNumber: entry.payload.weekNumber,
        foodExternalId: entry.payload.foodExternalId,
        isTicked: entry.payload.isTicked,
        occurredAt: entry.occurredAt,
        clientRequestId: entry.id,
        basedOnPlanVersion,
      });
      return undefined;
    case 'measurementAdded':
      await api.addMeasurementEndpoint({
        ...entry.payload,
        occurredAt: entry.occurredAt,
        clientRequestId: entry.id,
        basedOnPlanVersion,
      });
      return undefined;
  }
}

const SHOPPING_LIST_KEY = ['nutrition', 'shoppingList'] as const;

/** The queries to refetch once a write of this kind was sent or given up on, so the server's truth shows. */
export function invalidationKeys(kind: OutboxKind): readonly QueryKey[] {
  switch (kind) {
    case 'mealEaten':
    case 'mealUnlogged':
      return [TODAY_LOG_KEY, TODAY_PLAN_KEY, FULL_PLAN_KEY, WEEK_LOG_KEY];
    case 'offPlanAdded':
    case 'offPlanRemoved':
      return [TODAY_LOG_KEY];
    case 'shoppingTicked':
      return [SHOPPING_LIST_KEY];
    case 'measurementAdded':
      return [MEASUREMENTS_QUERY_KEY, PROFILE_SUMMARY_QUERY_KEY];
  }
}
