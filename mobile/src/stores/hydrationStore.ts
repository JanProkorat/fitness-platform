/**
 * hydrationStore — daily water-intake tracking + reminder settings.
 *
 * Storage keys (all MMKV, instance 'mmkv.hydration'):
 *   hydration:v1:log       — DrinkLog[] (per-drink rows, rolling 7 days)
 *                            NOTE: v1 log key is reused — only the settings
 *                            key is versioned (v1 → v2 → v3) because the log
 *                            shape has not changed.
 *   hydration:v3:settings  — HydrationSettingsV3 (target + UUID-keyed slots + enabled flag)
 *
 * Migration (v1 → v2 → v3 settings):
 *   v1→v2: slots (ReminderTime[], slotsEnabled: boolean[]) → UUID-keyed ReminderSlot[].
 *   v2→v3: additive `enabled` boolean.
 *     Default: if targetMl was previously configured (≠ DEFAULT_TARGET_ML or slots
 *     exist), derive enabled=true (user had actively used the feature).
 *     Otherwise enabled=false (fresh install or default-only state).
 *
 * Old reminder MMKV keys (water-slot-0 … water-slot-N) from v1 are cancelled
 * by the consumer (tabs _layout) after migration so they are re-scheduled under
 * the new UUID-keyed names.
 *
 * Reminder MMKV keys are stored by reminderScheduler under 'mmkv.reminders'
 * using the scheme  reminders:v1:water-slot-<slotId>.
 *
 * Daily totals are computed lazily by selector. No scheduled reset timer is
 * needed — the selectors filter by today's local date key.
 */

import { create } from 'zustand'
import { createMMKV } from 'react-native-mmkv'
import type { ReminderTime } from '@/lib/reminderScheduler'

// ─── MMKV instance ────────────────────────────────────────────────────────────

// Guard: MMKV throws on Node SSR (expo-web pre-render pass).
function createStore() {
  if (typeof window === 'undefined') return null
  return createMMKV({ id: 'mmkv.hydration' })
}

const mmkv = createStore()

// ─── Constants ────────────────────────────────────────────────────────────────

const LOG_KEY = 'hydration:v1:log'
const SETTINGS_KEY_V1 = 'hydration:v1:settings'
const SETTINGS_KEY_V2 = 'hydration:v2:settings'
const SETTINGS_KEY_V3 = 'hydration:v3:settings'
export const MAX_SLOTS = 8
const DAYS_RETENTION = 7
const DEFAULT_TARGET_ML = 2500

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A single reminder slot with a stable UUID identity.
 * Replaces the old (ReminderTime + parallel slotsEnabled[]) pattern.
 */
export interface ReminderSlot {
  /** Stable UUID — used as the MMKV reminder key suffix. */
  id: string
  hour: number
  minute: number
  enabled: boolean
}

export interface DrinkLog {
  /** UUID string, unique per drink entry. */
  id: string
  /** ISO 8601 timestamp. */
  timestampISO: string
  amountMl: number
}

/** Shape stored under hydration:v2:settings. */
export interface HydrationSettingsV2 {
  targetMl: number
  slots: ReminderSlot[]
}

/**
 * Shape stored under hydration:v3:settings.
 * Adds `enabled` flag to gate the feature on/off.
 */
export interface HydrationSettingsV3 {
  targetMl: number
  slots: ReminderSlot[]
  /**
   * Whether the user has switched on the hydration-tracking feature.
   * Default derivation on migration from v2: true when targetMl ≠ DEFAULT_TARGET_ML
   * or when any slot exists — meaning the user had previously configured the feature.
   * False on a fresh install (v2 default-only state with no prior configuration).
   */
  enabled: boolean
}

/**
 * Legacy shape (hydration:v1:settings).
 * Kept for migration read only — never written.
 */
interface HydrationSettingsV1 {
  targetMl: number
  slots: ReminderTime[]
  slotsEnabled: boolean[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Simple UUID v4 generator (no external dependency). */
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Returns YYYY-MM-DD in local time for a given ISO timestamp string. */
function dayKey(isoTimestamp: string): string {
  const d = new Date(isoTimestamp)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Returns today's YYYY-MM-DD string in local time. */
function todayKey(): string {
  return dayKey(new Date().toISOString())
}

/** Returns ISO date string for N days ago at 00:00:00 local time. */
function daysAgoISO(days: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

// ─── MMKV read helpers ────────────────────────────────────────────────────────

function readLog(): DrinkLog[] {
  if (!mmkv) return []
  try {
    const raw = mmkv.getString(LOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed as DrinkLog[]
  } catch {
    // Malformed JSON — fall back to defaults; the next write will overwrite.
    return []
  }
}

function writeLog(log: DrinkLog[]): void {
  if (!mmkv) return
  mmkv.set(LOG_KEY, JSON.stringify(log))
}

/**
 * Detect whether a parsed settings object is the old v1 shape.
 * V1: has a `slotsEnabled` array (v2 folds enabled into each slot).
 */
function isV1Shape(parsed: object): parsed is HydrationSettingsV1 {
  return 'slotsEnabled' in parsed && Array.isArray((parsed as HydrationSettingsV1).slotsEnabled)
}

/**
 * Detect whether a parsed settings object already has UUID-keyed slots (v2/v3).
 * V2+: slots[0] has an `id` string field.
 */
function isV2Shape(parsed: object): parsed is HydrationSettingsV2 {
  const s = parsed as HydrationSettingsV2
  return (
    Array.isArray(s.slots) &&
    (s.slots.length === 0 || typeof (s.slots[0] as ReminderSlot).id === 'string')
  )
}

/**
 * Detect whether a parsed settings object is already v3 shape (has `enabled` field).
 */
function isV3Shape(parsed: object): parsed is HydrationSettingsV3 {
  return isV2Shape(parsed) && typeof (parsed as HydrationSettingsV3).enabled === 'boolean'
}

const DEFAULT_SLOTS: ReminderSlot[] = [
  { id: uuid(), hour: 8, minute: 0, enabled: false },
  { id: uuid(), hour: 11, minute: 0, enabled: false },
  { id: uuid(), hour: 14, minute: 0, enabled: false },
  { id: uuid(), hour: 17, minute: 0, enabled: false },
  { id: uuid(), hour: 20, minute: 0, enabled: false },
]

/**
 * Read + migrate settings to v3 format.
 *
 * Returns:
 *   { settings, migratedFromV1: boolean, oldV1IndexCount: number }
 *
 * When migratedFromV1 is true the caller must:
 *   1. Cancel old reminders keyed water-slot-0 .. water-slot-(oldV1IndexCount-1).
 *   2. Re-schedule any enabled slots under their new UUID keys.
 *   3. The v1 MMKV key has already been deleted inside this function.
 */
function readSettings(): {
  settings: HydrationSettingsV3
  migratedFromV1: boolean
  oldV1IndexCount: number
} {
  const fallback: HydrationSettingsV3 = {
    targetMl: DEFAULT_TARGET_ML,
    slots: DEFAULT_SLOTS,
    // Fresh install — feature is disabled by default; user must turn on in Profile.
    enabled: false,
  }

  if (!mmkv) {
    return { settings: fallback, migratedFromV1: false, oldV1IndexCount: 0 }
  }

  // ── Try v3 key first ──────────────────────────────────────────────────────
  try {
    const rawV3 = mmkv.getString(SETTINGS_KEY_V3)
    if (rawV3) {
      const parsed = JSON.parse(rawV3) as unknown
      if (typeof parsed === 'object' && parsed !== null && isV3Shape(parsed)) {
        return { settings: parsed, migratedFromV1: false, oldV1IndexCount: 0 }
      }
    }
  } catch {
    // Malformed v3 — fall through.
  }

  // ── Try v2 key (v2→v3 migration) ─────────────────────────────────────────
  try {
    const rawV2 = mmkv.getString(SETTINGS_KEY_V2)
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as unknown
      if (typeof parsed === 'object' && parsed !== null && isV2Shape(parsed)) {
        const v2 = parsed as HydrationSettingsV2
        // Derive enabled: true if user had previously configured the feature
        // (changed target from default OR has at least one slot).
        // Rationale: a user who had the tab enabled had presumably used it.
        const derivedEnabled = v2.targetMl !== DEFAULT_TARGET_ML || v2.slots.length > 0
        const v3: HydrationSettingsV3 = {
          targetMl: v2.targetMl,
          slots: v2.slots,
          enabled: derivedEnabled,
        }
        mmkv.set(SETTINGS_KEY_V3, JSON.stringify(v3))
        mmkv.remove(SETTINGS_KEY_V2)
        return { settings: v3, migratedFromV1: false, oldV1IndexCount: 0 }
      }
    }
  } catch {
    // Malformed v2 — fall through to try v1, then default.
  }

  // ── Try v1 key (v1→v3 migration) ─────────────────────────────────────────
  try {
    const rawV1 = mmkv.getString(SETTINGS_KEY_V1)
    if (rawV1) {
      const parsed = JSON.parse(rawV1) as unknown
      if (typeof parsed === 'object' && parsed !== null && isV1Shape(parsed)) {
        const v1 = parsed as HydrationSettingsV1
        const oldCount = v1.slots.length
        const migratedSlots: ReminderSlot[] = v1.slots.map((s, i) => ({
          id: uuid(),
          hour: s.hour,
          minute: s.minute,
          enabled: v1.slotsEnabled[i] ?? false,
        }))
        const derivedEnabled = (v1.targetMl ?? DEFAULT_TARGET_ML) !== DEFAULT_TARGET_ML || oldCount > 0
        const v3: HydrationSettingsV3 = {
          targetMl: v1.targetMl ?? DEFAULT_TARGET_ML,
          slots: migratedSlots,
          enabled: derivedEnabled,
        }
        // Write v3 and delete v1 atomically (best-effort — MMKV is not
        // transactional but the worst case is re-migrating on the next boot,
        // which is idempotent since we write v3 first).
        mmkv.set(SETTINGS_KEY_V3, JSON.stringify(v3))
        mmkv.remove(SETTINGS_KEY_V1)
        return { settings: v3, migratedFromV1: true, oldV1IndexCount: oldCount }
      }
    }
  } catch {
    // Malformed v1 — fall through to defaults.
  }

  // ── No usable state — write fresh defaults ────────────────────────────────
  mmkv.set(SETTINGS_KEY_V3, JSON.stringify(fallback))
  return { settings: fallback, migratedFromV1: false, oldV1IndexCount: 0 }
}

function writeSettings(settings: HydrationSettingsV3): void {
  if (!mmkv) return
  mmkv.set(SETTINGS_KEY_V3, JSON.stringify(settings))
}

// ─── Selectors (pure functions over store state) ──────────────────────────────

export function selectTodayDrinks(log: DrinkLog[]): DrinkLog[] {
  const today = todayKey()
  return log.filter((d) => dayKey(d.timestampISO) === today)
}

export function selectTodayTotalMl(log: DrinkLog[]): number {
  return selectTodayDrinks(log).reduce((sum, d) => sum + d.amountMl, 0)
}

/** Returns last 7 days including today, newest first. */
export function selectLast7DaysTotals(log: DrinkLog[]): { date: string; totalMl: number }[] {
  const result: { date: string; totalMl: number }[] = []
  for (let i = 0; i < DAYS_RETENTION; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = dayKey(d.toISOString())
    const totalMl = log
      .filter((entry) => dayKey(entry.timestampISO) === key)
      .reduce((sum, entry) => sum + entry.amountMl, 0)
    result.push({ date: key, totalMl })
  }
  return result
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface HydrationState {
  targetMl: number
  slots: ReminderSlot[]
  log: DrinkLog[]
  /** Whether the hydration tracking feature is enabled by the user. */
  enabled: boolean
  /**
   * Populated only on the very first store creation if the MMKV data was
   * migrated from v1 (index-based) to v2/v3 (UUID-based).  The caller
   * (tabs _layout bootstrap effect) reads this once and cancels the old
   * index-keyed reminders, then resets it to 0.
   *
   * Stored as the count of old v1 slots so the layout can iterate
   * 0..<count to cancel each old key.
   */
  pendingMigrationV1Count: number
}

interface HydrationActions {
  setTarget: (ml: number) => void
  setEnabled: (on: boolean) => void
  setSlotTime: (id: string, time: Pick<ReminderSlot, 'hour' | 'minute'>) => void
  setSlotEnabled: (id: string, on: boolean) => void
  addSlot: () => void
  removeSlot: (id: string) => void
  addDrink: (amountMl: number, timestampISO?: string) => void
  removeDrink: (id: string) => void
  /** Remove entries older than beforeIso. Called on store hydration. */
  pruneOldDrinks: (beforeIso: string) => void
  /** Called by the layout after it has cancelled the v1 reminders. */
  clearMigrationFlag: () => void
  /**
   * Wipes the entire mmkv.hydration instance (log + settings) and resets
   * in-memory state to fresh defaults. Called on logout to prevent a
   * subsequent user on the same device from seeing the previous user's
   * hydration history/settings (#602).
   */
  reset: () => void
}

type HydrationStore = HydrationState & HydrationActions

const { settings: initialSettings, migratedFromV1, oldV1IndexCount } = readSettings()
const initialLog = readLog()

export const useHydrationStore = create<HydrationStore>((set, get) => {
  // Prune on initialisation (lazy 7-day rolling retention).
  const cutoff = daysAgoISO(DAYS_RETENTION)
  const prunedLog = initialLog.filter((d) => d.timestampISO >= cutoff)
  if (prunedLog.length !== initialLog.length) {
    writeLog(prunedLog)
  }

  return {
    // ── State ──────────────────────────────────────────────────────────
    targetMl: initialSettings.targetMl,
    slots: initialSettings.slots,
    enabled: initialSettings.enabled,
    log: prunedLog,
    pendingMigrationV1Count: migratedFromV1 ? oldV1IndexCount : 0,

    // ── Actions ────────────────────────────────────────────────────────

    setTarget: (ml) => {
      set((s) => {
        const next: HydrationSettingsV3 = { targetMl: ml, slots: s.slots, enabled: s.enabled }
        writeSettings(next)
        return { targetMl: ml }
      })
    },

    setEnabled: (on) => {
      set((s) => {
        const next: HydrationSettingsV3 = { targetMl: s.targetMl, slots: s.slots, enabled: on }
        writeSettings(next)
        return { enabled: on }
      })
    },

    setSlotTime: (id, time) => {
      set((s) => {
        const slots = s.slots.map((slot) =>
          slot.id === id ? { ...slot, hour: time.hour, minute: time.minute } : slot,
        )
        const next: HydrationSettingsV3 = { targetMl: s.targetMl, slots, enabled: s.enabled }
        writeSettings(next)
        return { slots }
      })
    },

    setSlotEnabled: (id, on) => {
      set((s) => {
        const slots = s.slots.map((slot) => (slot.id === id ? { ...slot, enabled: on } : slot))
        const next: HydrationSettingsV3 = { targetMl: s.targetMl, slots, enabled: s.enabled }
        writeSettings(next)
        return { slots }
      })
    },

    addSlot: () => {
      set((s) => {
        if (s.slots.length >= MAX_SLOTS) return {}
        const slots: ReminderSlot[] = [...s.slots, { id: uuid(), hour: 8, minute: 0, enabled: false }]
        const next: HydrationSettingsV3 = { targetMl: s.targetMl, slots, enabled: s.enabled }
        writeSettings(next)
        return { slots }
      })
    },

    removeSlot: (id) => {
      set((s) => {
        const slots = s.slots.filter((slot) => slot.id !== id)
        const next: HydrationSettingsV3 = { targetMl: s.targetMl, slots, enabled: s.enabled }
        writeSettings(next)
        return { slots }
      })
    },

    addDrink: (amountMl, timestampISO) => {
      const drink: DrinkLog = {
        id: uuid(),
        timestampISO: timestampISO ?? new Date().toISOString(),
        amountMl,
      }
      set((s) => {
        const log = [...s.log, drink]
        writeLog(log)
        return { log }
      })
    },

    removeDrink: (id) => {
      set((s) => {
        const log = s.log.filter((d) => d.id !== id)
        writeLog(log)
        return { log }
      })
    },

    pruneOldDrinks: (beforeIso) => {
      const current = get().log
      const pruned = current.filter((d) => d.timestampISO >= beforeIso)
      if (pruned.length !== current.length) {
        writeLog(pruned)
        set({ log: pruned })
      }
    },

    clearMigrationFlag: () => {
      set({ pendingMigrationV1Count: 0 })
    },

    reset: () => {
      if (mmkv) {
        mmkv.clearAll()
      }
      set({
        targetMl: DEFAULT_TARGET_ML,
        slots: DEFAULT_SLOTS,
        enabled: false,
        log: [],
        pendingMigrationV1Count: 0,
      })
    },
  }
})
