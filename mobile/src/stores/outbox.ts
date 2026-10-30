import Storage from 'expo-sqlite/kv-store';
import { useMemo } from 'react';
import { create } from 'zustand';

import { targetOf } from '@/lib/outbox/types';
import type {
  DropReason,
  DroppedEntry,
  EntryLabel,
  OutboxEntry,
  OutboxKind,
  OutboxMeta,
  SyncConflict,
} from '@/lib/outbox/types';
import { isDroppedEntry, isOutboxEntry, isSyncConflict } from '@/lib/outbox/validate';

/** Versioned on purpose and separate from the query snapshot: an app upgrade must not erase pending writes. */
export const OUTBOX_STORAGE_KEY = 'outbox.v1';
const MAX_DROPPED = 50;
const MAX_CONFLICTS = 50;

type OutboxState = {
  /** Pending writes, oldest first; the head is the next one to send. */
  entries: OutboxEntry[];
  /** Entries given up on, newest last, until the UI clears them. */
  droppedEntries: DroppedEntry[];
  /** Writes that collided with a plan change, newest last, until the UI clears them. */
  syncConflicts: SyncConflict[];
  hydrate: () => Promise<void>;
  enqueue: (entry: OutboxEntry) => Promise<void>;
  updateEntry: (id: string, patch: Partial<Pick<OutboxMeta, 'attempts' | 'lastError'>>) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  /** Removes the entry and records why it will never be sent. */
  dropEntry: (entry: OutboxEntry, reason: DropReason, label?: EntryLabel) => Promise<void>;
  /** Records that a sent write collided with a plan change; the same entry is recorded once. */
  addSyncConflict: (conflict: SyncConflict) => Promise<void>;
  clearDropped: () => void;
  /** Clears the dropped entries and the conflicts together; the "Got it" action. */
  clearSyncNotices: () => Promise<void>;
  /** Forgets everything in memory and on disk; used on login and logout. */
  wipe: () => Promise<void>;
};

type StoredOutbox = { entries: OutboxEntry[]; droppedEntries: DroppedEntry[]; syncConflicts: SyncConflict[] };

const EMPTY_STORED: StoredOutbox = { entries: [], droppedEntries: [], syncConflicts: [] };

async function readStored(): Promise<StoredOutbox> {
  try {
    const raw = await Storage.getItemAsync(OUTBOX_STORAGE_KEY);
    if (!raw) return EMPTY_STORED;
    const document: unknown = JSON.parse(raw);
    if (typeof document !== 'object' || document === null) return EMPTY_STORED;
    const { entries, dropped, conflicts } = document as { entries?: unknown; dropped?: unknown; conflicts?: unknown };
    return {
      entries: Array.isArray(entries) ? entries.filter(isOutboxEntry) : [],
      droppedEntries: Array.isArray(dropped) ? dropped.filter(isDroppedEntry) : [],
      // Absent in documents written before conflicts were kept.
      syncConflicts: Array.isArray(conflicts) ? conflicts.filter(isSyncConflict) : [],
    };
  } catch {
    // An unreadable store holds nothing worth replaying.
    return EMPTY_STORED;
  }
}

// Writes are chained and read the state when they run, so the last write on disk is always the latest state.
let writeChain: Promise<void> = Promise.resolve();
function persist(): Promise<void> {
  writeChain = writeChain.then(async () => {
    const { entries, droppedEntries, syncConflicts } = useOutboxStore.getState();
    try {
      if (entries.length === 0 && droppedEntries.length === 0 && syncConflicts.length === 0) {
        await Storage.removeItemAsync(OUTBOX_STORAGE_KEY);
      } else {
        await Storage.setItemAsync(
          OUTBOX_STORAGE_KEY,
          JSON.stringify({ entries, dropped: droppedEntries, conflicts: syncConflicts }),
        );
      }
    } catch {
      // The in-memory queue still works; the next change tries the disk again.
    }
  });
  return writeChain;
}

let hydration: Promise<void> | null = null;
/** Bumped by `wipe` so a load that was already running cannot bring the wiped entries back. */
let epoch = 0;

export const useOutboxStore = create<OutboxState>((set, get) => ({
  entries: [],
  droppedEntries: [],
  syncConflicts: [],

  hydrate: () => {
    if (hydration) return hydration;
    const startedAt = epoch;
    hydration = (async () => {
      const stored = await readStored();
      if (epoch !== startedAt) return;
      const hadLocalChanges =
        get().entries.length > 0 || get().droppedEntries.length > 0 || get().syncConflicts.length > 0;
      set((state) => ({
        entries: [...stored.entries.filter((entry) => !state.entries.some((own) => own.id === entry.id)), ...state.entries],
        droppedEntries: [...stored.droppedEntries, ...state.droppedEntries].slice(-MAX_DROPPED),
        syncConflicts: [
          ...stored.syncConflicts.filter((saved) => !state.syncConflicts.some((own) => own.id === saved.id)),
          ...state.syncConflicts,
        ].slice(-MAX_CONFLICTS),
      }));
      if (hadLocalChanges) await persist();
    })();
    return hydration;
  },

  enqueue: (entry) => {
    set((state) => ({ entries: [...state.entries, entry] }));
    return persist();
  },

  updateEntry: (id, patch) => {
    set((state) => ({ entries: state.entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)) }));
    return persist();
  },

  removeEntry: (id) => {
    set((state) => ({ entries: state.entries.filter((entry) => entry.id !== id) }));
    return persist();
  },

  dropEntry: (entry, reason, label) => {
    const dropped: DroppedEntry = {
      id: entry.id,
      kind: entry.kind,
      target: targetOf(entry),
      reason,
      at: new Date().toISOString(),
      ...(label ? { label } : {}),
    };
    set((state) => ({
      entries: state.entries.filter((own) => own.id !== entry.id),
      droppedEntries: [...state.droppedEntries, dropped].slice(-MAX_DROPPED),
    }));
    return persist();
  },

  addSyncConflict: (conflict) => {
    set((state) =>
      state.syncConflicts.some((own) => own.id === conflict.id)
        ? state
        : { syncConflicts: [...state.syncConflicts, conflict].slice(-MAX_CONFLICTS) },
    );
    return persist();
  },

  clearDropped: () => {
    set({ droppedEntries: [] });
    void persist();
  },

  clearSyncNotices: () => {
    set({ droppedEntries: [], syncConflicts: [] });
    return persist();
  },

  wipe: () => {
    epoch += 1;
    hydration = Promise.resolve();
    set({ entries: [], droppedEntries: [], syncConflicts: [] });
    return persist();
  },
}));

/** Pending entries as target ids per kind, so a row can tell it has not reached the server. */
export type PendingKeys = Record<OutboxKind, ReadonlySet<string>>;

export function buildPendingKeys(entries: readonly OutboxEntry[]): PendingKeys {
  const keys: Record<OutboxKind, Set<string>> = {
    mealEaten: new Set(),
    mealUnlogged: new Set(),
    offPlanAdded: new Set(),
    offPlanRemoved: new Set(),
    shoppingTicked: new Set(),
    measurementAdded: new Set(),
  };
  for (const entry of entries) keys[entry.kind].add(targetOf(entry));
  return keys;
}

export function usePendingKeys(): PendingKeys {
  const entries = useOutboxStore((state) => state.entries);
  return useMemo(() => buildPendingKeys(entries), [entries]);
}

export const useDroppedEntries = (): DroppedEntry[] => useOutboxStore((state) => state.droppedEntries);

export const useSyncConflicts = (): SyncConflict[] => useOutboxStore((state) => state.syncConflicts);
