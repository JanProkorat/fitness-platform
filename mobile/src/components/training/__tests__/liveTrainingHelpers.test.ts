/**
 * Unit tests for liveTrainingHelpers — pure functions, no RN dependencies.
 */

import {
  isPR,
  computeLiveSummary,
  computeRestRemaining,
  formatSeconds,
} from '../liveTrainingHelpers'
import type { FormOverride } from '@/stores/liveSessionStore'

// ─── formatSeconds ────────────────────────────────────────────────────────────

describe('formatSeconds', () => {
  it('formats 0 as 00:00', () => expect(formatSeconds(0)).toBe('00:00'))
  it('formats 59 as 00:59', () => expect(formatSeconds(59)).toBe('00:59'))
  it('formats 60 as 01:00', () => expect(formatSeconds(60)).toBe('01:00'))
  it('formats 90 as 01:30', () => expect(formatSeconds(90)).toBe('01:30'))
  it('formats 3600 as 60:00', () => expect(formatSeconds(3600)).toBe('60:00'))
  it('clamps negative to 00:00', () => expect(formatSeconds(-5)).toBe('00:00'))
})

// ─── computeRestRemaining ─────────────────────────────────────────────────────

describe('computeRestRemaining', () => {
  it('returns full duration when rest just started', () => {
    const now = new Date().toISOString()
    const result = computeRestRemaining(90, now)
    // Allow 1 s delta for test execution time.
    expect(result).toBeGreaterThan(88)
    expect(result).toBeLessThanOrEqual(90)
  })

  it('returns 0 when rest has elapsed', () => {
    const past = new Date(Date.now() - 120_000).toISOString() // 120 s ago
    expect(computeRestRemaining(90, past)).toBe(0)
  })

  it('accounts for 45 s of background time', () => {
    const fortyFiveSecondsAgo = new Date(Date.now() - 45_000).toISOString()
    const result = computeRestRemaining(90, fortyFiveSecondsAgo)
    expect(result).toBeGreaterThan(43)
    expect(result).toBeLessThan(47)
  })
})

// ─── isPR ─────────────────────────────────────────────────────────────────────

describe('isPR', () => {
  const exId = 'ex-bench'

  it('returns true when no prior logs exist', () => {
    expect(isPR({}, exId, 80)).toBe(true)
  })

  it('returns true when logged weight beats prior max', () => {
    const overrides: Record<string, Record<number, FormOverride>> = {
      [exId]: { 0: { reps: 10, weightKg: 80 } },
    }
    expect(isPR(overrides, exId, 82.5)).toBe(true)
  })

  it('returns false when logged weight equals prior max', () => {
    const overrides: Record<string, Record<number, FormOverride>> = {
      [exId]: { 0: { reps: 10, weightKg: 80 } },
    }
    expect(isPR(overrides, exId, 80)).toBe(false)
  })

  it('returns false when logged weight is less than prior max', () => {
    const overrides: Record<string, Record<number, FormOverride>> = {
      [exId]: {
        0: { reps: 10, weightKg: 80 },
        1: { reps: 8, weightKg: 82.5 },
      },
    }
    expect(isPR(overrides, exId, 80)).toBe(false)
  })

  it('returns false for bodyweight exercises (weight=0)', () => {
    expect(isPR({}, exId, 0)).toBe(false)
  })

  it('ignores other exercises when checking', () => {
    const overrides: Record<string, Record<number, FormOverride>> = {
      'ex-other': { 0: { reps: 10, weightKg: 200 } },
    }
    // exId has no logs → true
    expect(isPR(overrides, exId, 80)).toBe(true)
  })

  it('handles missing weightKg in override gracefully', () => {
    const overrides: Record<string, Record<number, FormOverride>> = {
      [exId]: { 0: { reps: 10 } }, // no weightKg
    }
    // prevMax stays 0 → 80 > 0 → true
    expect(isPR(overrides, exId, 80)).toBe(true)
  })
})

// ─── computeLiveSummary ───────────────────────────────────────────────────────

describe('computeLiveSummary', () => {
  const startedAt = '2024-01-01T10:00:00.000Z'
  const finishedAt = '2024-01-01T10:43:12.000Z' // 43 min 12 s later

  it('computes correct duration', () => {
    const result = computeLiveSummary(startedAt, finishedAt, [], 0)
    expect(result.durationFormatted).toBe('43:12')
  })

  it('sums setsDone, totalReps, and volume correctly', () => {
    const exercises = [
      {
        plannedSetCount: 4,
        doneSets: [
          { done: true, reps: 10, weightKg: 80 },
          { done: true, reps: 10, weightKg: 80 },
          { done: false, reps: 0, weightKg: 0 }, // skipped
        ],
      },
      {
        plannedSetCount: 3,
        doneSets: [
          { done: true, reps: 12, weightKg: 0 }, // bodyweight
        ],
      },
    ]
    const result = computeLiveSummary(startedAt, finishedAt, exercises, 2)

    expect(result.setsDone).toBe(3) // 2 + 1
    expect(result.setsPlanned).toBe(7) // 4 + 3
    expect(result.totalReps).toBe(32) // 10+10+12
    expect(result.volumeKg).toBe(1600) // 10*80 + 10*80 + 0 (BW)
    expect(result.prCount).toBe(2)
  })

  it('handles empty exercise list', () => {
    const result = computeLiveSummary(startedAt, finishedAt, [], 0)
    expect(result.setsDone).toBe(0)
    expect(result.setsPlanned).toBe(0)
    expect(result.totalReps).toBe(0)
    expect(result.volumeKg).toBe(0)
  })
})
