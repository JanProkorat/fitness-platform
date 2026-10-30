import { SeenMealItemKind } from '@/api/generated';
import type { DroppedEntry, EntryLabel, OutboxEntry, SyncConflict } from '@/lib/outbox/types';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isIsoTime = (value: unknown): value is string => isText(value) && !Number.isNaN(Date.parse(value));

function isMacroSet(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNumber(value.kcal) &&
    isNumber(value.protein) &&
    isNumber(value.carbs) &&
    isNumber(value.fat) &&
    isNumber(value.fiber)
  );
}

function isSeenItem(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.kind === SeenMealItemKind.Food || value.kind === SeenMealItemKind.Recipe) &&
    isText(value.refId) &&
    typeof value.name === 'string' &&
    isNumber(value.amount) &&
    isNumber(value.kcal)
  );
}

function isPayload(kind: unknown, payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  switch (kind) {
    case 'mealEaten':
      return (
        isText(payload.mealId) &&
        (payload.seenItems === undefined || (Array.isArray(payload.seenItems) && payload.seenItems.every(isSeenItem)))
      );
    case 'mealUnlogged':
      return isText(payload.mealId);
    case 'offPlanAdded':
      return (
        isText(payload.entryId) &&
        isText(payload.foodExternalId) &&
        typeof payload.foodName === 'string' &&
        isNumber(payload.amountGrams) &&
        isMacroSet(payload.per100)
      );
    case 'offPlanRemoved':
      return isText(payload.entryId);
    case 'shoppingTicked':
      return isNumber(payload.weekNumber) && isText(payload.foodExternalId) && typeof payload.isTicked === 'boolean';
    case 'measurementAdded':
      return isIsoTime(payload.measuredAt);
    default:
      return false;
  }
}

/** Runtime check for an entry read back from disk; anything malformed is dropped on load. */
export function isOutboxEntry(value: unknown): value is OutboxEntry {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isIsoTime(value.occurredAt) &&
    (value.basedOnPlanVersion === null || isNumber(value.basedOnPlanVersion)) &&
    isNumber(value.attempts) &&
    (value.lastError === null || typeof value.lastError === 'string') &&
    isPayload(value.kind, value.payload)
  );
}

const DROP_REASONS: readonly unknown[] = ['tooOld', 'notFound', 'conflict', 'rejected'];
const KINDS: readonly unknown[] = [
  'mealEaten',
  'mealUnlogged',
  'offPlanAdded',
  'offPlanRemoved',
  'shoppingTicked',
  'measurementAdded',
];

const isOptionalText = (value: unknown): boolean => value === undefined || typeof value === 'string';

function isEntryLabel(value: unknown): value is EntryLabel {
  return (
    isRecord(value) &&
    isOptionalText(value.name) &&
    isOptionalText(value.mealKind) &&
    (value.date === undefined || isIsoTime(value.date))
  );
}

export function isDroppedEntry(value: unknown): value is DroppedEntry {
  return (
    isRecord(value) &&
    isText(value.id) &&
    KINDS.includes(value.kind) &&
    typeof value.target === 'string' &&
    DROP_REASONS.includes(value.reason) &&
    isIsoTime(value.at) &&
    (value.label === undefined || isEntryLabel(value.label))
  );
}

const CONFLICT_KINDS: readonly unknown[] = ['planChanged', 'mealRemoved'];

export function isSyncConflict(value: unknown): value is SyncConflict {
  return (
    isRecord(value) &&
    isText(value.id) &&
    CONFLICT_KINDS.includes(value.kind) &&
    isText(value.mealId) &&
    isEntryLabel(value.label) &&
    isIsoTime(value.at)
  );
}
