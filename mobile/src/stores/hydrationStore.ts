/**
 * hydrationStore — daily water-intake tracking + reminder settings.
 *
 * Storage keys (all MMKV, instance 'mmkv.hydration'):
 *   hydration:v1:log       — DrinkLog[] (per-drink rows, rolling 7 days)
 *   hydration:v1:settings  — HydrationSettings (target + slots)
 *
 * Reminder MMKV keys are stored by reminderScheduler under 'mmkv.reminders'
 * using the scheme  reminders:v1:water-slot-<index>.
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
const SETTINGS_KEY = 'hydration:v1:settings'
const MAX_SLOTS = 8
const DAYS_RETENTION = 7
const DEFAULT_TARGET_ML = 2500

const DEFAULT_SLOTS: ReminderTime[] = [
  { hour: 8, minute: 0 },
  { hour: 11, minute: 0 },
  { hour: 14, minute: 0 },
  { hour: 17, minute: 0 },
  { hour: 20, minute: 0 },
]

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DrinkLog {
  /** UUID string, unique per drink entry. */
  id: string
  /** ISO 8601 timestamp. */
  timestampISO: string
  amountMl: number
}

export interface HydrationSettings {
  targetMl: number
  slots: ReminderTime[]
  slotsEnabled: boolean[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

/** Simple UUID v4 generator (no external dependency). */
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
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

function readSettings(): HydrationSettings {
  if (!mmkv) return { targetMl: DEFAULT_TARGET_ML, slots: DEFAULT_SLOTS, slotsEnabled: DEFAULT_SLOTS.map(() => true) }
  try {
    const raw = mmkv.getString(SETTINGS_KEY)
    if (!raw) return { targetMl: DEFAULT_TARGET_ML, slots: DEFAULT_SLOTS, slotsEnabled: DEFAULT_SLOTS.map(() => true) }
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) {
      return { targetMl: DEFAULT_TARGET_ML, slots: DEFAULT_SLOTS, slotsEnabled: DEFAULT_SLOTS.map(() => true) }
    }
    return parsed as HydrationSettings
  } catch {
    // Malformed JSON — fall back to defaults.
    return { targetMl: DEFAULT_TARGET_ML, slots: DEFAULT_SLOTS, slotsEnabled: DEFAULT_SLOTS.map(() => true) }
  }
}

function writeSettings(settings: HydrationSettings): void {
  if (!mmkv) return
  mmkv.set(SETTINGS_KEY, JSON.stringify(settings))
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
  slots: ReminderTime[]
  slotsEnabled: boolean[]
  log: DrinkLog[]
}

interface HydrationActions {
  setTarget: (ml: number) => void
  setSlotTime: (index: number, time: ReminderTime) => void
  setSlotEnabled: (index: number, on: boolean) => void
  addSlot: () => void
  removeSlot: (index: number) => void
  addDrink: (amountMl: number, timestampISO?: string) => void
  removeDrink: (id: string) => void
  /** Remove entries older than beforeIso. Called on store hydration. */
  pruneOldDrinks: (beforeIso: string) => void
}

type HydrationStore = HydrationState & HydrationActions

const initialSettings = readSettings()
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
    slotsEnabled: initialSettings.slotsEnabled,
    log: prunedLog,

    // ── Actions ────────────────────────────────────────────────────────

    setTarget: (ml) => {
      set((s) => {
        const next: HydrationSettings = { targetMl: ml, slots: s.slots, slotsEnabled: s.slotsEnabled }
        writeSettings(next)
        return { targetMl: ml }
      })
    },

    setSlotTime: (index, time) => {
      set((s) => {
        const slots = s.slots.map((slot, i) => (i === index ? time : slot))
        const next: HydrationSettings = { targetMl: s.targetMl, slots, slotsEnabled: s.slotsEnabled }
        writeSettings(next)
        return { slots }
      })
    },

    setSlotEnabled: (index, on) => {
      set((s) => {
        const slotsEnabled = s.slotsEnabled.map((v, i) => (i === index ? on : v))
        const next: HydrationSettings = { targetMl: s.targetMl, slots: s.slots, slotsEnabled }
        writeSettings(next)
        return { slotsEnabled }
      })
    },

    addSlot: () => {
      set((s) => {
        if (s.slots.length >= MAX_SLOTS) return {}
        const slots = [...s.slots, { hour: 8, minute: 0 }]
        const slotsEnabled = [...s.slotsEnabled, false]
        const next: HydrationSettings = { targetMl: s.targetMl, slots, slotsEnabled }
        writeSettings(next)
        return { slots, slotsEnabled }
      })
    },

    removeSlot: (index) => {
      set((s) => {
        const slots = s.slots.filter((_, i) => i !== index)
        const slotsEnabled = s.slotsEnabled.filter((_, i) => i !== index)
        const next: HydrationSettings = { targetMl: s.targetMl, slots, slotsEnabled }
        writeSettings(next)
        return { slots, slotsEnabled }
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
  }
})
