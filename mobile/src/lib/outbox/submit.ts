import { isOfflineFailure } from '@/api/errors';
import { drainOutbox, isDraining } from '@/lib/outbox/drain';
import { newClientId } from '@/lib/outbox/id';
import { currentPlanVersion } from '@/lib/outbox/planVersion';
import { sendEntry } from '@/lib/outbox/send';
import type { OutboxEntry, OutboxWrite } from '@/lib/outbox/types';
import { useAuthStore } from '@/stores/auth';
import { selectIsOffline, useConnectivityStore } from '@/stores/connectivity';
import { useOutboxStore } from '@/stores/outbox';

export type SubmitResult = 'sent' | 'queued';

// Writes go through one lane, so one that fails offline is queued before the next one decides where to go.
let lane: Promise<unknown> = Promise.resolve();
function inLane<T>(task: () => Promise<T>): Promise<T> {
  const run = lane.then(task, task);
  lane = run.catch(() => undefined);
  return run;
}

/**
 * Sends a client write, or queues it. It queues when the API cannot be reached, and whenever the outbox already
 * holds entries (so order is kept). A queued write resolves like a sent one; only a real rejection throws.
 */
export function submitWrite(write: OutboxWrite, options: { occurredAt?: string } = {}): Promise<SubmitResult> {
  return inLane(async () => {
    await useOutboxStore.getState().hydrate();
    const generation = useAuthStore.getState().sessionGeneration;
    const entry: OutboxEntry = {
      ...write,
      id: newClientId(),
      occurredAt: options.occurredAt ?? new Date().toISOString(),
      basedOnPlanVersion: currentPlanVersion(),
      attempts: 0,
      lastError: null,
    };

    const queue = async (): Promise<SubmitResult> => {
      // A session that ended meanwhile must not leave this write behind for the next user.
      if (useAuthStore.getState().sessionGeneration !== generation) throw new Error('The session ended');
      await useOutboxStore.getState().enqueue(entry);
      void drainOutbox();
      return 'queued';
    };

    if (
      useOutboxStore.getState().entries.length > 0 ||
      isDraining() ||
      selectIsOffline(useConnectivityStore.getState())
    ) {
      return queue();
    }
    try {
      await sendEntry(entry);
      return 'sent';
    } catch (error: unknown) {
      if (isOfflineFailure(error)) return queue();
      throw error;
    }
  });
}
