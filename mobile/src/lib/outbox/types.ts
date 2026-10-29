import type { AddMeasurementRequest } from '@/api/generated';

/** Nutrient amounts in the units the day log uses. */
export type MacroSet = { kcal: number; protein: number; carbs: number; fat: number; fiber: number };

/** A measurement as the client records it, without the offline-sync metadata the outbox adds. */
export type MeasurementPayload = Omit<AddMeasurementRequest, 'occurredAt' | 'clientRequestId' | 'basedOnPlanVersion'>;

/** What a queued write does. One variant per client write that may be replayed later. */
export type OutboxWrite =
  | { kind: 'mealEaten'; payload: { mealId: string } }
  | { kind: 'mealUnlogged'; payload: { mealId: string } }
  | {
      kind: 'offPlanAdded';
      payload: {
        entryId: string;
        foodExternalId: string;
        foodName: string;
        amountGrams: number;
        /** Nutrients per 100 g from the picked search result, used to build the local row. */
        per100: MacroSet;
      };
    }
  | { kind: 'offPlanRemoved'; payload: { entryId: string } }
  | { kind: 'shoppingTicked'; payload: { weekNumber: number; foodExternalId: string; isTicked: boolean } }
  | { kind: 'measurementAdded'; payload: MeasurementPayload };

export type OutboxKind = OutboxWrite['kind'];

export type OutboxMeta = {
  /** The ClientRequestId sent with the write; a replay with the same id applies once. */
  id: string;
  /** ISO time the user acted. */
  occurredAt: string;
  /** The plan version seen when the write was queued; null while the plan reads carry none. */
  basedOnPlanVersion: number | null;
  attempts: number;
  lastError: string | null;
};

export type OutboxEntry = OutboxMeta & OutboxWrite;

export type DropReason = 'tooOld' | 'notFound' | 'conflict' | 'rejected';

/** What a note names, captured when it is recorded because the cached data may be gone after the next refetch. */
export type EntryLabel = {
  /** Food name, for entries about a food. */
  name?: string;
  /** Plan meal kind such as "lunch", translated when shown. */
  mealKind?: string;
  /** ISO time of the day the user acted on. */
  date?: string;
};

/** An entry that was given up on; the Nutrition tab shows a note for it. */
export type DroppedEntry = {
  id: string;
  kind: OutboxKind;
  /** Meal id, off-plan entry id, "week:food" or the measurement time, per kind. */
  target: string;
  reason: DropReason;
  /** ISO time the entry was dropped. */
  at: string;
  label?: EntryLabel;
};

export type SyncConflictKind = 'planChanged' | 'mealRemoved';

/** A write that reached the server but collided with a change the coach made to the plan. */
export type SyncConflict = {
  /** The id of the entry that collided. */
  id: string;
  kind: SyncConflictKind;
  mealId: string;
  label: EntryLabel;
  /** ISO time the conflict was recorded. */
  at: string;
};

/** The id a row can match against `usePendingKeys()` to know it is not synced yet. */
export function targetOf(write: OutboxWrite): string {
  switch (write.kind) {
    case 'mealEaten':
    case 'mealUnlogged':
      return write.payload.mealId;
    case 'offPlanAdded':
    case 'offPlanRemoved':
      return write.payload.entryId;
    case 'shoppingTicked':
      return `${write.payload.weekNumber}:${write.payload.foodExternalId}`;
    case 'measurementAdded':
      return write.payload.measuredAt;
  }
}
