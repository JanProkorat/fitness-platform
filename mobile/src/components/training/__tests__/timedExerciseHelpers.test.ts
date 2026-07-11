/**
 * Unit tests for timedExerciseHelpers — pure functions, no RN dependencies.
 * Extracted from TimedExerciseFocus (#728, behavior-preserving refactor).
 */

import {
  formatCountdown,
  decrementDistance,
  incrementDistance,
  computeFinishTimerDuration,
} from '../timedExerciseHelpers'

// ─── formatCountdown ────────────────────────────────────────────────────────

describe('formatCountdown', () => {
  it('formats whole seconds as MM:SS', () => {
    expect(formatCountdown(65)).toBe('01:05')
  })

  it('formats zero seconds as 00:00', () => {
    expect(formatCountdown(0)).toBe('00:00')
  })

  it('clamps negative input to 0', () => {
    expect(formatCountdown(-5)).toBe('00:00')
  })

  it('rounds up fractional seconds via Math.ceil', () => {
    // 59.2 -> ceil -> 60 -> 01:00
    expect(formatCountdown(59.2)).toBe('01:00')
  })

  it('rounds up small fractional remainders below a minute', () => {
    // 10.1 -> ceil -> 11 -> 00:11
    expect(formatCountdown(10.1)).toBe('00:11')
  })

  it('formats multi-minute durations with zero-padded seconds', () => {
    expect(formatCountdown(605)).toBe('10:05')
  })

  it('formats exactly one minute', () => {
    expect(formatCountdown(60)).toBe('01:00')
  })
})

// ─── distance stepper rounding ──────────────────────────────────────────────

describe('decrementDistance', () => {
  it('decreases by 10', () => {
    expect(decrementDistance(50)).toBe(40)
  })

  it('clamps at a minimum of 0', () => {
    expect(decrementDistance(5)).toBe(0)
  })

  it('does not go negative from 0', () => {
    expect(decrementDistance(0)).toBe(0)
  })

  it('rounds to 1 decimal place', () => {
    expect(decrementDistance(15.05)).toBeCloseTo(5.1, 5)
  })

  it('clamps exactly at 10 to 0', () => {
    expect(decrementDistance(10)).toBe(0)
  })
})

describe('incrementDistance', () => {
  it('increases by 10', () => {
    expect(incrementDistance(50)).toBe(60)
  })

  it('increases from 0', () => {
    expect(incrementDistance(0)).toBe(10)
  })

  it('rounds to 1 decimal place', () => {
    expect(incrementDistance(15.05)).toBeCloseTo(25.1, 5)
  })
})

// ─── computeFinishTimerDuration ─────────────────────────────────────────────

describe('computeFinishTimerDuration', () => {
  it('computes duration when the timer is running (started, elapsed via wall clock)', () => {
    // Started 12s ago (now - startedAt = 12000ms), plannedDurationSeconds=60, remaining=48
    // elapsed = round(12000/1000) = 12
    // duration = plannedDurationSeconds - remaining + elapsed = 60 - 48 + 12 = 24
    const result = computeFinishTimerDuration({
      timerRunning: true,
      remaining: 48,
      plannedDurationSeconds: 60,
      startedAt: 0,
      now: 12000,
    })
    expect(result).toBe(24)
  })

  it('computes duration when the timer is paused (not running, startedAt set from a stale prior run)', () => {
    // timerRunning=false branch ignores `elapsed` entirely — duration is
    // simply plannedDurationSeconds - remaining, regardless of startedAt/now.
    const result = computeFinishTimerDuration({
      timerRunning: false,
      remaining: 48,
      plannedDurationSeconds: 60,
      startedAt: 0,
      now: 12000,
    })
    expect(result).toBe(12)
  })

  it('computes duration when startedAt is null and timer is not running (elapsed derived from remaining)', () => {
    // startedAt === null -> elapsed = round(plannedDurationSeconds - remaining) = round(60-48) = 12
    // timerRunning=false -> duration = plannedDurationSeconds - remaining = 12
    const result = computeFinishTimerDuration({
      timerRunning: false,
      remaining: 48,
      plannedDurationSeconds: 60,
      startedAt: null,
      now: 12000,
    })
    expect(result).toBe(12)
  })

  it('computes duration when startedAt is null and timer is running (elapsed derived from remaining)', () => {
    // elapsed = round(60 - 48) = 12
    // duration = plannedDurationSeconds - remaining + elapsed = 60 - 48 + 12 = 24
    const result = computeFinishTimerDuration({
      timerRunning: true,
      remaining: 48,
      plannedDurationSeconds: 60,
      startedAt: null,
      now: 12000,
    })
    expect(result).toBe(24)
  })

  it('rounds the final duration to the nearest integer', () => {
    // plannedDurationSeconds - remaining = 60 - 47.6 = 12.4 -> round -> 12
    const result = computeFinishTimerDuration({
      timerRunning: false,
      remaining: 47.6,
      plannedDurationSeconds: 60,
      startedAt: null,
      now: 0,
    })
    expect(result).toBe(12)
  })

  it('returns 0 when finishing immediately at the planned duration with full remaining', () => {
    const result = computeFinishTimerDuration({
      timerRunning: false,
      remaining: 60,
      plannedDurationSeconds: 60,
      startedAt: null,
      now: 0,
    })
    expect(result).toBe(0)
  })
})
