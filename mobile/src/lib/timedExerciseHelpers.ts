/**
 * Pure helper functions for TimedExerciseFocus (Time/Distance movement hero).
 * All functions are side-effect-free and fully unit-testable without RN.
 */

// ─── Countdown formatting ───────────────────────────────────────────────────

/**
 * Format seconds as MM:SS.
 */
export function formatCountdown(secs: number): string {
  const s = Math.max(0, Math.ceil(secs))
  const m = Math.floor(s / 60)
  const remaining = s % 60
  return `${String(m).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
}

// ─── Distance stepper rounding ──────────────────────────────────────────────

/**
 * Decrease distance by 10, clamped to a minimum of 0, rounded to 1 decimal.
 */
export function decrementDistance(d: number): number {
  return Math.max(0, Math.round((d - 10) * 10) / 10)
}

/**
 * Increase distance by 10, rounded to 1 decimal.
 */
export function incrementDistance(d: number): number {
  return Math.round((d + 10) * 10) / 10
}

// ─── Finish-timer duration math ─────────────────────────────────────────────

/**
 * Compute the duration (seconds, rounded) to report via onSetDone when the
 * user finishes the timer early (or after expiry).
 *
 * Mirrors the original handleFinishTimer math verbatim — NOT simplified,
 * even though the `elapsed` local looks unused in the `timerRunning` branch.
 * That's original behavior; a behavior-preserving refactor must not "fix" it.
 */
export function computeFinishTimerDuration(params: {
  timerRunning: boolean
  remaining: number
  plannedDurationSeconds: number
  startedAt: number | null
  now: number
}): number {
  const { timerRunning, remaining, plannedDurationSeconds, startedAt, now } = params
  const elapsed = startedAt !== null
    ? Math.round((now - startedAt) / 1000)
    : Math.round(plannedDurationSeconds - remaining)
  const duration = timerRunning
    ? plannedDurationSeconds - remaining + elapsed
    : plannedDurationSeconds - remaining
  return Math.round(duration)
}
