import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import type { FoodSummary, GetTodayLogResponse } from '@/api/generated';
import { TODAY_LOG_KEY } from '@/api/nutrition';
import { macrosOf } from '@/components/nutrition/meal/format';
import { applyOffPlanAdded, applyOffPlanRemoved } from '@/lib/outbox/apply';
import { submitWrite } from '@/lib/outbox/submit';
import type { OutboxWrite } from '@/lib/outbox/types';

/** `entryId` is chosen by the client, so the entry can be removed before the add reaches the server. */
export type AddOffPlanVariables = { entryId: string; food: FoodSummary; amountGrams: number };

type AddedPayload = Extract<OutboxWrite, { kind: 'offPlanAdded' }>['payload'];

const addedPayload = ({ entryId, food, amountGrams }: AddOffPlanVariables): AddedPayload => ({
  entryId,
  foodExternalId: food.foodId ?? '',
  foodName: food.name || food.rawName || '',
  amountGrams,
  per100: macrosOf(food.nutrientValue),
});

/** Logs a food eaten outside the plan; the row appears at once and is rolled back if the server rejects it. */
export function useAddOffPlanFood() {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: (variables: AddOffPlanVariables) => submitWrite({ kind: 'offPlanAdded', payload: addedPayload(variables) }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: TODAY_LOG_KEY });
      const previous = queryClient.getQueryData<GetTodayLogResponse>(TODAY_LOG_KEY);
      queryClient.setQueryData<GetTodayLogResponse>(
        TODAY_LOG_KEY,
        applyOffPlanAdded(previous, addedPayload(variables), new Date().toISOString()),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(TODAY_LOG_KEY, context?.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: TODAY_LOG_KEY });
    },
  });
}

const isSameLocalDay = (first: Date, second: Date): boolean => first.toDateString() === second.toDateString();

/** Removes an off-plan entry of today; the row goes at once and comes back if the server rejects it. */
export function useRemoveOffPlanFood() {
  const queryClient = useQueryClient();
  // The row is gone from the cache by the time the call is made, so its time is kept here.
  const loggedAt = useRef(new Map<string, string>());

  return useMutation({
    networkMode: 'always',
    mutationFn: (entryId: string) => {
      const now = new Date();
      const entryTime = loggedAt.current.get(entryId);
      loggedAt.current.delete(entryId);
      // The server finds the day log by this time, so it must lie on the entry's own day even if it is sent later.
      const occurredAt = entryTime && !isSameLocalDay(new Date(entryTime), now) ? entryTime : now.toISOString();
      return submitWrite({ kind: 'offPlanRemoved', payload: { entryId } }, { occurredAt });
    },
    onMutate: async (entryId) => {
      await queryClient.cancelQueries({ queryKey: TODAY_LOG_KEY });
      const previous = queryClient.getQueryData<GetTodayLogResponse>(TODAY_LOG_KEY);
      const row = previous?.offPlanFoods?.find((candidate) => candidate.entryId === entryId);
      if (row?.loggedAt) loggedAt.current.set(entryId, row.loggedAt);
      queryClient.setQueryData<GetTodayLogResponse>(TODAY_LOG_KEY, applyOffPlanRemoved(previous, { entryId }));
      return { previous };
    },
    onError: (_error, _entryId, context) => {
      queryClient.setQueryData(TODAY_LOG_KEY, context?.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: TODAY_LOG_KEY });
    },
  });
}
