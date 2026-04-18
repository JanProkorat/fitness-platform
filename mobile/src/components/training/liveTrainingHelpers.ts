/**
 * Pure helper functions for the live training assistant screen.
 * All functions are side-effect-free and fully unit-testable without RN.
 */

import type { FormOverride } from '@/stores/liveSessionStore'

// ─── PR detection ─────────────────────────────────────────────────────────────

/**
 * Returns true if `weightKg` is strictly greater than every previously
 * logged weight for `exerciseExternalId` in the current session.
 *
 * "Previously logged" means any set in formOverrides[exerciseExternalId] that
 * has a weightKg value — including sets from earlier in the same exercise before
 * this one is recorded.
 *
 * @param formOverrides   The store's current formOverrides map.
 * @param exerciseExternalId  The exercise being evaluated.
 * @param weightKg        The weight the user just logged.
 */
export function isPR(
  formOverrides: Record<string, Record<number, FormOverride>>,
  exerciseExternalId: string,
  weightKg: number,
): boolean {
  if (weightKg <= 0) return false
  const overrides = formOverrides[exerciseExternalId]
  if (!overrides) return true // nothing logged yet → first set is always a PR candidate

  let prevMax = 0
  for (const override of Object.values(overrides)) {
    const w = override.weightKg
    if (w != null && w > prevMax) prevMax = w
  }
  return weightKg > prevMax
}

// ─── Finished-summary math ───────────────────────────────────────────────────

export interface LiveSummary {
  /** MM:SS formatted elapsed duration */
  durationFormatted: string
  /** Number of sets marked done */
  setsDone: number
  /** Total planned sets across all exercises */
  setsPlanned: number
  /** Sum of reps across all completed sets */
  totalReps: number
  /** Sum of reps × weightKg across all completed sets (0 for bodyweight) */
  volumeKg: number
  /** Number of PR flashes fired during the session */
  prCount: number
}

export interface SetEntry {
  done: boolean
  reps: number
  weightKg: number
}

export interface ExerciseSummaryInput {
  plannedSetCount: number
  doneSets: SetEntry[]
}

/**
 * Compute the finished-screen summary stats from raw session data.
 *
 * @param startedAt    ISO timestamp from liveSessionStore.startedAt
 * @param finishedAt   ISO timestamp from liveSessionStore.finishedAt (or now)
 * @param exercises    Per-exercise input with planned counts and done sets
 * @param prCount      Number of PR flashes during the session
 */
export function computeLiveSummary(
  startedAt: string,
  finishedAt: string,
  exercises: ExerciseSummaryInput[],
  prCount: number,
): LiveSummary {
  const elapsedSeconds = Math.max(
    0,
    Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 1000),
  )

  let setsDone = 0
  let setsPlanned = 0
  let totalReps = 0
  let volumeKg = 0

  for (const ex of exercises) {
    setsPlanned += ex.plannedSetCount
    for (const s of ex.doneSets) {
      if (s.done) {
        setsDone += 1
        totalReps += s.reps
        if (s.weightKg > 0) volumeKg += s.reps * s.weightKg
      }
    }
  }

  return {
    durationFormatted: formatSeconds(elapsedSeconds),
    setsDone,
    setsPlanned,
    totalReps,
    volumeKg: Math.round(volumeKg),
    prCount,
  }
}

// ─── Rest-remaining computation ───────────────────────────────────────────────

/**
 * Compute how many seconds of rest remain given persisted wall-clock timestamps.
 * Returns 0 if the rest period has already elapsed.
 *
 * @param restSeconds     Total rest duration stored in the session.
 * @param restStartedAt   ISO timestamp when rest started (from liveSessionStore).
 */
export function computeRestRemaining(restSeconds: number, restStartedAt: string): number {
  const elapsed = (Date.now() - Date.parse(restStartedAt)) / 1000
  return Math.max(0, restSeconds - elapsed)
}

// ─── Time formatting ──────────────────────────────────────────────────────────

/**
 * Format a duration in seconds as "MM:SS".
 */
export function formatSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
