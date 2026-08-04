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
 *
 * Persistence versioning (#240, #872):
 *   Version 2 — re-keyed wodResults from Record<exerciseExternalId | sectionId, WodResult>.
 *   The old format used a special sentinel key ("session-level WOD key") that has been
 *   replaced by the actual sectionId. Any persisted v1 state with that sentinel key is
 *   migrated by dropping the legacy entry (the runner re-derives from the current section).
 *
 *   Version 3 (#872) — the training-session read shape moved from
 *   sections/exercises to workouts/standaloneExercises. `wodResults`' section-
 *   level half of its key space changes MEANING, not just name: a `sectionId`
 *   from before this migration is a value from a retired document shape and
 *   cannot be resolved to the new `workoutId` space (a fresh, distinct id
 *   assigned when the plan was created/updated under the new shape — see
 *   TrainingWorkout, no 1:1 carry-over from the old sectionId). The
 *   exerciseExternalId half of the key space (per-exercise WOD format
 *   overrides, still catalog-keyed by design — see the live-log carve-out
 *   note below) is unaffected in MEANING, but since a single wodResults map
 *   mixes both halves under one key space with no version-time way to tell
 *   which entries are which, v2→v3 drops the whole map rather than
 *   attempting a partial, lossy remap. All other persisted maps
 *   (`completedSets`, `skippedSets`, `skippedExercises`, `formOverrides`)
 *   keep their exerciseExternalId keying unchanged — they feed the live-log
 *   write path (`UpdateWodExerciseRequest`/`workouts.ts`), which stays
 *   catalog-keyed by design and is out of #872's scope.
 */

import { create } from 'zustand'
import { createMMKV } from 'react-native-mmkv'
import type { WodResult } from '@/api/wod-types'

const MMKV_KEY = 'session'
const PERSIST_VERSION = 3
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
  /** Actual duration for MovementType.Time exercises (seconds). */
  durationSeconds?: number
  /** Actual distance for MovementType.Distance exercises (metres). */
  distanceMeters?: number
}

export interface LiveSessionState {
  /** Schema version. Used for MMKV migration. */
  _version?: number
  /** WorkoutLog id returned by startWorkout. null = no active session. */
  activeLogId: string | null
  planId: string | null
  sessionId: string | null
  /** ISO timestamp of when start() was called. */
  startedAt: string | null
  currentExerciseIdx: number
  currentSetIdx: number
  /**
   * Active index within the current session's ordered items list (the
   * interleave of TrainingWorkout blocks and standalone-exercise wrappers,
   * merged by their shared `order` sequence — see
   * `trainingCardFormat.getOrderedSessionItems`). Null when the session has
   * no items.
   */
  currentSectionIdx: number | null
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
  /**
   * WOD outcomes keyed by sectionId (for section-level WODs) or by
   * exerciseExternalId (for per-exercise format overrides).
   * Populated by finalizeWod(); persisted to MMKV.
   *
   * (#240) The old sentinel key for session-level WODs has been removed.
   * Keys are now always real sectionId or exerciseExternalId strings.
   */
  wodResults: Record<string, WodResult>
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
   * Moves to the next section by index.
   * Called when a section's final exercise is done in the section-aware runner.
   */
  advanceSection: (sectionIdx: number) => void

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

  // ── WOD result actions ────────────────────────────────────────────────────

  /**
   * Increments `roundsCompleted` for the given key by 1.
   * key = sectionId for section-level WODs, exerciseExternalId for per-exercise WODs.
   */
  recordRound: (key: string) => void

  /**
   * Toggles a failed-round marker for the given round number.
   * If the round is already in failedRounds it is removed; otherwise appended.
   */
  markRoundFailed: (key: string, roundNumber: number) => void

  /**
   * Sets `extraReps` for the given key.
   * Used by AMRAP at the end of the time cap.
   */
  setExtraReps: (key: string, reps: number) => void

  /**
   * Writes the final WodResult for the given key to the store.
   * Call at the moment the timer expires or the user taps FINISH.
   * Persists to MMKV.
   */
  finalizeWod: (key: string, result: WodResult) => void
}

export type LiveSessionStore = LiveSessionState & LiveSessionActions

// ─── Persistence helpers ──────────────────────────────────────────────────────

const INITIAL_STATE: LiveSessionState = {
  _version: PERSIST_VERSION,
  activeLogId: null,
  planId: null,
  sessionId: null,
  startedAt: null,
  currentExerciseIdx: 0,
  currentSetIdx: 0,
  currentSectionIdx: null,
  completedSets: {},
  skippedSets: {},
  skippedExercises: [],
  restStartedAt: null,
  restSeconds: null,
  finishedAt: null,
  formOverrides: {},
  wodResults: {},
}

/**
 * Migrates a persisted state object from an older version to the current schema.
 *
 * v1 → v2: Drop any wodResults key that is the old session-level sentinel.
 *   The sentinel was a single fixed string used as a top-level WOD key.
 *   It is no longer valid — section-level WODs are now keyed by sectionId.
 *
 * v2 → v3 (#872): Drop `wodResults` entirely. Its keys meant either a
 *   (retired) sectionId or a catalog exerciseExternalId; the current shape
 *   needs a workoutId or a per-instance exerciseId instead, and neither can
 *   be derived from the old key without the plan tree in hand at migration
 *   time. An in-flight live session that had recorded WOD rounds loses that
 *   round-tracking on this one migration (the runner re-derives from the
 *   current position going forward); every other persisted field is
 *   unaffected and carries over untouched.
 */
function migrateState(raw: LiveSessionState): LiveSessionState {
  const version = raw._version ?? 1

  if (version >= PERSIST_VERSION) {
    return raw
  }

  let migratedWodResults: Record<string, WodResult> = raw.wodResults ?? {}

  if (version < 2) {
    // v1 → v2: drop the old session-level sentinel key from wodResults.
    // The key was a 13-char string starting with "__" (implementation detail
    // of the previous schema). We identify it by the double-underscore prefix
    // to avoid hard-coding the exact value in this file.
    const afterV2: Record<string, WodResult> = {}
    for (const [key, value] of Object.entries(migratedWodResults)) {
      if (key.startsWith('__')) {
        // Legacy sentinel — drop it. The section runner will produce a fresh result.
        continue
      }
      afterV2[key] = value
    }
    migratedWodResults = afterV2
  }

  if (version < 3) {
    // v2 → v3: the sectionId half of wodResults' key space is a value from
    // a retired document shape with no 1:1 mapping to the new workoutId
    // space — drop the whole map rather than attempt a partial remap.
    migratedWodResults = {}
  }

  return {
    ...raw,
    _version: PERSIST_VERSION,
    currentSectionIdx: raw.currentSectionIdx ?? null,
    wodResults: migratedWodResults,
  }
}

function getPersistedSession(): LiveSessionState {
  // SSR guard — Metro pre-renders on Node for expo-web where MMKV throws.
  if (typeof window === 'undefined') return { ...INITIAL_STATE }
  try {
    const raw = mmkv.getString(MMKV_KEY)
    if (!raw) return { ...INITIAL_STATE }
    const parsed = JSON.parse(raw) as LiveSessionState
    return migrateState(parsed)
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

  advanceSection(sectionIdx) {
    const s = get()
    const next: LiveSessionState = {
      ...s,
      currentSectionIdx: sectionIdx,
      currentExerciseIdx: 0,
      currentSetIdx: 0,
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

  recordRound(key) {
    const s = get()
    const prev = s.wodResults[key] ?? {}
    const next: LiveSessionState = {
      ...s,
      wodResults: {
        ...s.wodResults,
        [key]: { ...prev, roundsCompleted: (prev.roundsCompleted ?? 0) + 1 },
      },
    }
    persist(next)
    set(next)
  },

  markRoundFailed(key, roundNumber) {
    const s = get()
    const prev = s.wodResults[key] ?? {}
    const existing = prev.failedRounds ?? []
    const next: LiveSessionState = {
      ...s,
      wodResults: {
        ...s.wodResults,
        [key]: {
          ...prev,
          failedRounds: existing.includes(roundNumber)
            ? existing.filter((r) => r !== roundNumber)
            : [...existing, roundNumber].sort((a, b) => a - b),
        },
      },
    }
    persist(next)
    set(next)
  },

  setExtraReps(key, reps) {
    const s = get()
    const prev = s.wodResults[key] ?? {}
    const next: LiveSessionState = {
      ...s,
      wodResults: { ...s.wodResults, [key]: { ...prev, extraReps: reps } },
    }
    persist(next)
    set(next)
  },

  finalizeWod(key, result) {
    const s = get()
    const next: LiveSessionState = {
      ...s,
      wodResults: { ...s.wodResults, [key]: result },
    }
    persist(next)
    set(next)
  },
}))
