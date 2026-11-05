import Storage from 'expo-sqlite/kv-store';
import { useMemo } from 'react';
import { create } from 'zustand';

import { OUTBOX_MAX_AGE_MS, targetOf } from '@/lib/outbox/types';
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

/**
 * One document for the device, holding one queue per user id. Versioned on purpose and separate from the query
 * snapshot: an app upgrade must not erase pending writes.
 */
export const OUTBOX_STORAGE_KEY = 'outbox.v2';
/** The single-slot document written before queues were kept per user; it has no owner. */
const LEGACY_STORAGE_KEY = 'outbox.v1';
const MAX_DROPPED = 50;
const MAX_CONFLICTS = 50;

type OutboxState = {
  /** The user whose queue is loaded; null while nobody is signed in. */
  ownerUserId: string | null;
  /** Pending writes, oldest first; the head is the next one to send. */
  entries: OutboxEntry[];
  /** Entries given up on, newest last, until the UI clears them. */
  droppedEntries: DroppedEntry[];
  /** Writes that collided with a plan change, newest last, until the UI clears them. */
  syncConflicts: SyncConflict[];
  /**
   * Makes `userId`'s queue the active one. The previous user's queue stays on disk under their id.
   * `discardLegacy` is set for a fresh sign-in, which must not adopt the owner-less pre-upgrade queue.
   */
  bindUser: (userId: string, options?: { discardLegacy?: boolean }) => Promise<void>;
  /** Ends the active user's hold on the queue: their entries stay on disk, their notices are forgotten. */
  release: () => Promise<void>;
  /** Forgets the user's queue in memory and on disk, entries included; used when the account is deleted. */
  discardUser: (userId: string | null) => Promise<void>;
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
};

type StoredSlot = { entries: OutboxEntry[]; droppedEntries: DroppedEntry[]; syncConflicts: SyncConflict[] };
type StoredUsers = Record<string, StoredSlot>;

const EMPTY_SLOT: StoredSlot = { entries: [], droppedEntries: [], syncConflicts: [] };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function parseSlot(value: unknown): StoredSlot {
  if (!isRecord(value)) return EMPTY_SLOT;
  const { entries, dropped, conflicts } = value;
  return {
    entries: Array.isArray(entries) ? entries.filter(isOutboxEntry) : [],
    droppedEntries: Array.isArray(dropped) ? dropped.filter(isDroppedEntry) : [],
    syncConflicts: Array.isArray(conflicts) ? conflicts.filter(isSyncConflict) : [],
  };
}

const isExpired = (entry: OutboxEntry): boolean => Date.now() - Date.parse(entry.occurredAt) > OUTBOX_MAX_AGE_MS;

const isEmptySlot = (slot: StoredSlot): boolean =>
  slot.entries.length === 0 && slot.droppedEntries.length === 0 && slot.syncConflicts.length === 0;

/** Every user's queue on disk; an unreadable store holds nothing worth replaying. */
async function readUsers(): Promise<StoredUsers> {
  try {
    const raw = await Storage.getItemAsync(OUTBOX_STORAGE_KEY);
    if (!raw) return {};
    const document: unknown = JSON.parse(raw);
    if (!isRecord(document) || !isRecord(document.users)) return {};
    const users: StoredUsers = {};
    for (const [userId, slot] of Object.entries(document.users)) users[userId] = parseSlot(slot);
    return users;
  } catch {
    return {};
  }
}

/** The owner-less queue from before per-user slots; only its entries are worth adopting. */
async function readLegacyEntries(): Promise<OutboxEntry[]> {
  try {
    const raw = await Storage.getItemAsync(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    return parseSlot(JSON.parse(raw)).entries;
  } catch {
    return [];
  }
}

async function removeLegacy(): Promise<void> {
  try {
    await Storage.removeItemAsync(LEGACY_STORAGE_KEY);
  } catch {
    // Retried on the next load.
  }
}

/** Drops expired entries and empty queues of every user except `activeUserId`, whose own drain reports them. */
function pruneInactive(users: StoredUsers, activeUserId: string | null): StoredUsers {
  const kept: StoredUsers = {};
  for (const [userId, slot] of Object.entries(users)) {
    if (userId === activeUserId) {
      kept[userId] = slot;
      continue;
    }
    const entries = slot.entries.filter((entry) => !isExpired(entry));
    if (entries.length > 0) kept[userId] = { entries, droppedEntries: [], syncConflicts: [] };
  }
  return kept;
}

const countStored = (users: StoredUsers): number =>
  Object.values(users).reduce((total, slot) => total + slot.entries.length + 1, 0);

async function writeUsers(users: StoredUsers): Promise<void> {
  const userIds = Object.keys(users);
  if (userIds.length === 0) {
    await Storage.removeItemAsync(OUTBOX_STORAGE_KEY);
    return;
  }
  const document: Record<string, { entries: OutboxEntry[]; dropped: DroppedEntry[]; conflicts: SyncConflict[] }> = {};
  for (const userId of userIds) {
    const slot = users[userId];
    document[userId] = { entries: slot.entries, dropped: slot.droppedEntries, conflicts: slot.syncConflicts };
  }
  await Storage.setItemAsync(OUTBOX_STORAGE_KEY, JSON.stringify({ users: document }));
}

// Writes are chained and read the state when they run, so the last write on disk is always the latest state.
// Each write re-reads the document and replaces only the active user's queue, so other users' queues survive.
let writeChain: Promise<void> = Promise.resolve();
function persist(): Promise<void> {
  writeChain = writeChain.then(async () => {
    const { ownerUserId, entries, droppedEntries, syncConflicts } = useOutboxStore.getState();
    if (!ownerUserId) return;
    try {
      const users = pruneInactive(await readUsers(), ownerUserId);
      const slot: StoredSlot = { entries, droppedEntries, syncConflicts };
      if (isEmptySlot(slot)) delete users[ownerUserId];
      else users[ownerUserId] = slot;
      await writeUsers(users);
    } catch {
      // The in-memory queue still works; the next change tries the disk again.
    }
  });
  return writeChain;
}

/** Removes one user's queue from disk, in the same chain as the writes so a write cannot overtake it. */
function eraseUser(userId: string): Promise<void> {
  writeChain = writeChain.then(async () => {
    try {
      const users = pruneInactive(await readUsers(), useOutboxStore.getState().ownerUserId);
      delete users[userId];
      await writeUsers(users);
    } catch {
      // Nothing more can be done; the queue is already gone from memory.
    }
  });
  return writeChain;
}

let hydration: Promise<void> | null = null;
/** Bumped whenever the active user changes so a load that was already running cannot bring entries back. */
let epoch = 0;

export const useOutboxStore = create<OutboxState>((set, get) => ({
  ownerUserId: null,
  entries: [],
  droppedEntries: [],
  syncConflicts: [],

  bindUser: async (userId, options) => {
    if (get().ownerUserId === userId) return;
    if (get().ownerUserId) await get().release();
    epoch += 1;
    hydration = null;
    set({ ownerUserId: userId, entries: [], droppedEntries: [], syncConflicts: [] });
    if (options?.discardLegacy) await removeLegacy();
  },

  release: async () => {
    if (!get().ownerUserId) return;
    // An unfinished load would leave memory empty and the write below would erase the queue on disk.
    await get().hydrate();
    // Notices hold meal labels; only the queued writes may outlive the session.
    set({ droppedEntries: [], syncConflicts: [] });
    await persist();
    epoch += 1;
    hydration = null;
    set({ ownerUserId: null, entries: [], droppedEntries: [], syncConflicts: [] });
  },

  discardUser: async (userId) => {
    const target = userId ?? get().ownerUserId;
    epoch += 1;
    hydration = null;
    set({ ownerUserId: null, entries: [], droppedEntries: [], syncConflicts: [] });
    if (target) await eraseUser(target);
  },

  hydrate: () => {
    if (hydration) return hydration;
    const owner = get().ownerUserId;
    if (!owner) return Promise.resolve();
    const startedAt = epoch;
    hydration = (async () => {
      const users = await readUsers();
      const slot = users[owner] ?? EMPTY_SLOT;
      const legacyEntries = await readLegacyEntries();
      if (epoch !== startedAt) return;
      const hadLocalChanges =
        get().entries.length > 0 || get().droppedEntries.length > 0 || get().syncConflicts.length > 0;
      const stored = [...slot.entries, ...legacyEntries];
      set((state) => ({
        entries: [
          ...stored.filter(
            (entry, index) =>
              !state.entries.some((own) => own.id === entry.id) &&
              stored.findIndex((other) => other.id === entry.id) === index,
          ),
          ...state.entries,
        ],
        droppedEntries: [...slot.droppedEntries, ...state.droppedEntries].slice(-MAX_DROPPED),
        syncConflicts: [
          ...slot.syncConflicts.filter((saved) => !state.syncConflicts.some((own) => own.id === saved.id)),
          ...state.syncConflicts,
        ].slice(-MAX_CONFLICTS),
      }));
      // Writing back also clears expired entries and empty queues of the other users from the disk.
      const prunedOthers = countStored(pruneInactive(users, owner)) !== countStored(users);
      if (hadLocalChanges || legacyEntries.length > 0 || prunedOthers) await persist();
      // Removed only after the adopted entries are safe under the user's own id.
      if (legacyEntries.length > 0 && epoch === startedAt) await removeLegacy();
    })();
    return hydration;
  },

  enqueue: (entry) => {
    if (!get().ownerUserId) return Promise.reject(new Error('No signed-in user owns the outbox'));
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
}));

/** Pending entries as target ids per kind, so a row can tell it has not reached the server. */
export type PendingKeys = Record<OutboxKind, ReadonlySet<string>>;

export function buildPendingKeys(entries: readonly OutboxEntry[]): PendingKeys {
  const keys: Record<OutboxKind, Set<string>> = {
    mealEaten: new Set(),
    mealUnlogged: new Set(),
    mealItemEaten: new Set(),
    mealItemUnlogged: new Set(),
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
