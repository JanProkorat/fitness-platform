/**
 * liveSessionStore — persisted session state for the live training feature.
 *
 * Design choice — pure-index-advance:
 *   advance(nextExerciseIdx, nextSetIdx) takes the target indices as arguments
 *   rather than deriving them from the session tree. This keeps the store free
 *   of the full session shape; the screen (which already renders the exercise
 *   list) owns that logic and passes the next position. The tradeoff is that
 *   the caller must compute the next indices, but this matches the prototype
 *   pattern where _ltAdvanceAfterSet constructs nextExIdx/nextSetIdx before
 *   committing them (see docs/prototypes/mobile/scripts/live-training.js).
 *
 * Rest-timer math:
 *   restStartedAt (wall-clock ISO) + restSeconds are persisted. On resume from
 *   background the screen computes:
 *     remaining = restSeconds - (Date.now() - Date.parse(restStartedAt)) / 1000
 *   The store never holds a running interval; that stays in the screen layer.
 *
 * MMKV instance: mmkv.liveSession (separate instance, mirroring todayStore).
 */

import { create } from 'zustand'
import { createMMKV } from 'react-native-mmkv'

const MMKV_KEY = 'session'
const mmkv = createMMKV({ id: 'mmkv.liveSession' })

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Minimal session descriptor needed by start().
 * Consumers pass this from the API response; the store does not import
 * heavy plan types from generated.ts.
 */
export interface SessionLike {
  sessionId: string
}

export interface FormOverride {
  reps?: number
  weightKg?: number
}

export interface LiveSessionState {
  /** WorkoutLog id returned by startWorkout. null = no active session. */
  activeLogId: string | null
  planId: string | null
  sessionId: string | null
  /** ISO timestamp of when start() was called. */
  startedAt: string | null
  currentExerciseIdx: number
  currentSetIdx: number
  /** exerciseExternalId → sorted array of completed set indices. */
  completedSets: Record<string, number[]>
  /** exerciseExternalId → sorted array of skipped set indices. */
  skippedSets: Record<string, number[]>
  /** exerciseExternalIds that were entirely skipped. */
  skippedExercises: string[]
  /**
   * ISO timestamp when rest started. Combined with restSeconds allows
   * computing remaining time after app backgrounding:
   *   remaining = restSeconds - (Date.now() - Date.parse(restStartedAt)) / 1000
   */
  restStartedAt: string | null
  restSeconds: number | null
  /** ISO timestamp when finish() was called. */
  finishedAt: string | null
  /**
   * Actual reps/weight logged per set, keyed by exerciseExternalId then setIdx.
   * Populated by markSetDone() when actuals differ from the plan.
   */
  formOverrides: Record<string, Record<number, FormOverride>>
}

interface LiveSessionActions {
  /**
   * Seeds a brand-new session. Resets all progress fields, writes startedAt=now,
   * stores sessionId, planId, and activeLogId, persists to MMKV.
   */
  start: (session: SessionLike, logId: string, planId: string) => void

  /**
   * Records a completed set. Appends setIdx to completedSets[exerciseExternalId].
   * If actuals are provided they are stored in formOverrides. Does NOT auto-advance
   * indices — the screen calls advance() after startRest() or skipRest() as needed
   * (matching the prototype's rest-then-advance flow).
   */
  markSetDone: (
    exerciseExternalId: string,
    setIdx: number,
    actuals?: FormOverride,
  ) => void

  /** Records setIdx as skipped for the exercise without advancing. */
  skipSet: (exerciseExternalId: string, setIdx: number) => void

  /** Records the whole exercise as skipped and does NOT advance indices. */
  skipExercise: (exerciseExternalId: string) => void

  /** Stores rest start time + duration. Clears previous rest fields first. */
  startRest: (seconds: number) => void

  /** Clears rest fields (user tapped "Skip rest"). */
  skipRest: () => void

  /**
   * Moves (currentExerciseIdx, currentSetIdx) to the given position.
   * Called by the screen after skipRest() or directly when skipping without rest.
   */
  advance: (nextExerciseIdx: number, nextSetIdx: number) => void

  /**
   * Persists current state to MMKV without resetting anything.
   * Call when the app goes to background or the user navigates away mid-session.
   */
  close: () => void

  /**
   * No-op confirming the store has been hydrated from MMKV on init.
   * Screens can call this as a readiness gate; the real hydration happens
   * automatically at module load time via getPersistedSession().
   */
  resume: () => void

  /** Sets finishedAt=now, clears rest fields, persists. */
  finish: () => void

  /**
   * Clears the MMKV key and resets in-memory state to initial values.
   * Use when the user explicitly discards a session.
   */
  discard: () => void

  /** Returns true iff activeLogId is set and finishedAt is null. */
  hasActiveSession: () => boolean
}

export type LiveSessionStore = LiveSessionState & LiveSessionActions

// ─── Persistence helpers ──────────────────────────────────────────────────────

const INITIAL_STATE: LiveSessionState = {
  activeLogId: null,
  planId: null,
  sessionId: null,
  startedAt: null,
  currentExerciseIdx: 0,
  currentSetIdx: 0,
  completedSets: {},
  skippedSets: {},
  skippedExercises: [],
  restStartedAt: null,
  restSeconds: null,
  finishedAt: null,
  formOverrides: {},
}

function getPersistedSession(): LiveSessionState {
  // SSR guard — Metro pre-renders on Node for expo-web where MMKV throws.
  if (typeof window === 'undefined') return { ...INITIAL_STATE }
  try {
    const raw = mmkv.getString(MMKV_KEY)
    if (!raw) return { ...INITIAL_STATE }
    return JSON.parse(raw) as LiveSessionState
  } catch {
    return { ...INITIAL_STATE }
  }
}

function persist(state: LiveSessionState): void {
  mmkv.set(MMKV_KEY, JSON.stringify(state))
}

function clearPersisted(): void {
  mmkv.remove(MMKV_KEY)
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useLiveSessionStore = create<LiveSessionStore>((set, get) => ({
  ...getPersistedSession(),

  start(session, logId, planId) {
    const next: LiveSessionState = {
      ...INITIAL_STATE,
      activeLogId: logId,
      planId,
      sessionId: session.sessionId,
      startedAt: new Date().toISOString(),
    }
    persist(next)
    set(next)
  },

  markSetDone(exerciseExternalId, setIdx, actuals) {
    const s = get()
    const prev = s.completedSets[exerciseExternalId] ?? []
    const nextCompleted = prev.includes(setIdx) ? prev : [...prev, setIdx].sort((a, b) => a - b)

    const nextOverrides = { ...s.formOverrides }
    if (actuals !== undefined) {
      nextOverrides[exerciseExternalId] = {
        ...nextOverrides[exerciseExternalId],
        [setIdx]: actuals,
      }
    }

    const next: LiveSessionState = {
      ...s,
      completedSets: { ...s.completedSets, [exerciseExternalId]: nextCompleted },
      formOverrides: nextOverrides,
    }
    persist(next)
    set(next)
  },

  skipSet(exerciseExternalId, setIdx) {
    const s = get()
    const prev = s.skippedSets[exerciseExternalId] ?? []
    const nextSkipped = prev.includes(setIdx) ? prev : [...prev, setIdx].sort((a, b) => a - b)
    const next: LiveSessionState = {
      ...s,
      skippedSets: { ...s.skippedSets, [exerciseExternalId]: nextSkipped },
    }
    persist(next)
    set(next)
  },

  skipExercise(exerciseExternalId) {
    const s = get()
    const nextSkippedExercises = s.skippedExercises.includes(exerciseExternalId)
      ? s.skippedExercises
      : [...s.skippedExercises, exerciseExternalId]
    const next: LiveSessionState = {
      ...s,
      skippedExercises: nextSkippedExercises,
    }
    persist(next)
    set(next)
  },

  startRest(seconds) {
    const s = get()
    const next: LiveSessionState = {
      ...s,
      restStartedAt: new Date().toISOString(),
      restSeconds: seconds,
    }
    persist(next)
    set(next)
  },

  skipRest() {
    const s = get()
    const next: LiveSessionState = {
      ...s,
      restStartedAt: null,
      restSeconds: null,
    }
    persist(next)
    set(next)
  },

  advance(nextExerciseIdx, nextSetIdx) {
    const s = get()
    const next: LiveSessionState = {
      ...s,
      currentExerciseIdx: nextExerciseIdx,
      currentSetIdx: nextSetIdx,
    }
    persist(next)
    set(next)
  },

  close() {
    persist(get())
  },

  resume() {
    // Hydration is synchronous at module load time (getPersistedSession).
    // This method exists as a documented readiness gate for screens.
  },

  finish() {
    const s = get()
    const next: LiveSessionState = {
      ...s,
      finishedAt: new Date().toISOString(),
      restStartedAt: null,
      restSeconds: null,
    }
    persist(next)
    set(next)
  },

  discard() {
    clearPersisted()
    set({ ...INITIAL_STATE })
  },

  hasActiveSession() {
    const { activeLogId, finishedAt } = get()
    return activeLogId !== null && finishedAt === null
  },
}))
