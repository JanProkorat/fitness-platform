import { queryClient } from '@/lib/queryClient';
import { classifyFailure, describeFailure } from '@/lib/outbox/classify';
import { describeEntry, recordSyncOutcome } from '@/lib/outbox/label';
import { invalidationKeys, sendEntry } from '@/lib/outbox/send';
import type { OutboxKind } from '@/lib/outbox/types';
import { useAuthStore } from '@/stores/auth';
import { useOutboxStore } from '@/stores/outbox';

const DAY_MS = 24 * 60 * 60 * 1000;
/** The server rejects anything older, so an older entry is dropped on the device. */
export const OUTBOX_MAX_AGE_MS = 7 * DAY_MS;
const BACKOFF_BASE_MS = 30_000;
const BACKOFF_MAX_MS = 5 * 60_000;

let running = false;
let nextAttemptAt = 0;
let failureStreak = 0;
let trackedGeneration = -1;
/** Conflicts seen per entry in this app session. */
const conflicts = new Map<string, number>();

/** True while a drain is in progress; new writes then queue instead of sending. */
export const isDraining = (): boolean => running;

function startBackoff(wait: 'none' | 'rateLimit' | 'backoff'): void {
  if (wait === 'none') return;
  if (wait === 'rateLimit') {
    nextAttemptAt = Date.now() + BACKOFF_BASE_MS;
    return;
  }
  failureStreak += 1;
  nextAttemptAt = Date.now() + Math.min(BACKOFF_BASE_MS * 2 ** (failureStreak - 1), BACKOFF_MAX_MS);
}

/**
 * Sends the queued writes strictly in order, one at a time. Single-flight: a call while one is running does
 * nothing. Runs only for a signed-in session that already holds an access token, and stops as soon as that
 * session ends, so one user's writes never go out under another user's token.
 */
export async function drainOutbox(): Promise<void> {
  if (running) return;
  const auth = useAuthStore.getState();
  if (!auth.isAuthenticated || !auth.accessToken) return;
  const generation = auth.sessionGeneration;
  if (generation !== trackedGeneration) {
    trackedGeneration = generation;
    nextAttemptAt = 0;
    failureStreak = 0;
    conflicts.clear();
  }
  const alive = (): boolean => {
    const state = useAuthStore.getState();
    return state.isAuthenticated && state.sessionGeneration === generation;
  };

  running = true;
  const touched = new Set<OutboxKind>();
  try {
    await useOutboxStore.getState().hydrate();
    while (alive()) {
      const outbox = useOutboxStore.getState();
      const head = outbox.entries[0];
      if (!head || Date.now() < nextAttemptAt) break;

      if (Date.now() - Date.parse(head.occurredAt) > OUTBOX_MAX_AGE_MS) {
        await outbox.dropEntry(head, 'tooOld', describeEntry(head));
        touched.add(head.kind);
        continue;
      }

      let response: Awaited<ReturnType<typeof sendEntry>>;
      try {
        response = await sendEntry(head);
      } catch (error: unknown) {
        if (!alive()) break;
        const outcome = classifyFailure(error, head.kind, conflicts.get(head.id) ?? 0);
        if (outcome.type === 'drop') {
          await outbox.dropEntry(head, outcome.reason, describeEntry(head));
          touched.add(head.kind);
          continue;
        }
        if (outcome.type === 'keep') break;
        await outbox.updateEntry(head.id, { attempts: head.attempts + 1, lastError: describeFailure(error) });
        if (outcome.type === 'retryNow') {
          conflicts.set(head.id, (conflicts.get(head.id) ?? 0) + 1);
          continue;
        }
        startBackoff(outcome.wait);
        break;
      }

      if (!alive()) break;
      failureStreak = 0;
      conflicts.delete(head.id);
      // Name the meal now: the refetch that follows can drop a meal the coach removed from the cache.
      await recordSyncOutcome(head, response);
      await outbox.removeEntry(head.id);
      touched.add(head.kind);
    }
  } finally {
    running = false;
    if (alive()) {
      for (const kind of touched) {
        for (const queryKey of invalidationKeys(kind)) {
          void queryClient.invalidateQueries({ queryKey });
        }
      }
    }
  }
}
