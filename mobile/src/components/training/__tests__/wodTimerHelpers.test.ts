/**
 * Unit tests for wodTimerHelpers — pure functions + shared constant, no RN
 * dependencies. Extracted from WodTimerHero.tsx during the #728
 * decomposition (previously untested inline helpers).
 */

import { padTwo, formatTime, formatIntervalDuration, PREP_SECONDS } from '../wodTimerHelpers'

// ─── padTwo ───────────────────────────────────────────────────────────────────

describe('padTwo', () => {
  it('pads single-digit numbers with a leading zero', () => {
    expect(padTwo(0)).toBe('00')
    expect(padTwo(5)).toBe('05')
    expect(padTwo(9)).toBe('09')
  })

  it('leaves two-digit numbers unchanged', () => {
    expect(padTwo(10)).toBe('10')
    expect(padTwo(42)).toBe('42')
    expect(padTwo(59)).toBe('59')
  })

  it('does not truncate three-digit numbers', () => {
    expect(padTwo(100)).toBe('100')
  })

  it('floors fractional input', () => {
    expect(padTwo(5.9)).toBe('05')
  })

  it('clamps negative input to zero', () => {
    expect(padTwo(-3)).toBe('00')
  })
})

// ─── formatTime ───────────────────────────────────────────────────────────────

describe('formatTime', () => {
  it('formats zero seconds', () => {
    expect(formatTime(0)).toBe('00:00')
  })

  it('formats sub-minute durations', () => {
    expect(formatTime(5)).toBe('00:05')
    expect(formatTime(59)).toBe('00:59')
  })

  it('formats whole-minute durations', () => {
    expect(formatTime(60)).toBe('01:00')
    expect(formatTime(600)).toBe('10:00')
  })

  it('formats mixed minute+second durations', () => {
    expect(formatTime(90)).toBe('01:30')
    expect(formatTime(661)).toBe('11:01')
  })
})

// ─── formatIntervalDuration ───────────────────────────────────────────────────

describe('formatIntervalDuration', () => {
  it('returns "0 s" for zero or negative input', () => {
    expect(formatIntervalDuration(0)).toBe('0 s')
    expect(formatIntervalDuration(-5)).toBe('0 s')
  })

  it('renders sub-minute durations as "{N} s"', () => {
    expect(formatIntervalDuration(1)).toBe('1 s')
    expect(formatIntervalDuration(45)).toBe('45 s')
    expect(formatIntervalDuration(59)).toBe('59 s')
  })

  it('renders whole-minute multiples as "{N} min"', () => {
    expect(formatIntervalDuration(60)).toBe('1 min')
    expect(formatIntervalDuration(120)).toBe('2 min')
    expect(formatIntervalDuration(600)).toBe('10 min')
  })

  it('renders mixed values as "M:SS min"', () => {
    expect(formatIntervalDuration(90)).toBe('1:30 min')
    expect(formatIntervalDuration(125)).toBe('2:05 min')
  })
})

// ─── PREP_SECONDS ─────────────────────────────────────────────────────────────

describe('PREP_SECONDS', () => {
  it('is 10 seconds — the pre-roll window shared by all four timers', () => {
    expect(PREP_SECONDS).toBe(10)
  })
})
