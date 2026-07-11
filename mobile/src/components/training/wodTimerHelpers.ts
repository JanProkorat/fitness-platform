/**
 * wodTimerHelpers — pure formatting helpers + shared constants for the WOD
 * timer sub-components (AmrapTimer, EmomTimer, TabataTimer, ForTimeTimer).
 *
 * Extracted verbatim from WodTimerHero.tsx during the #728 decomposition —
 * no formatting/math changes. `PREP_SECONDS` lives here (not inside a
 * single timer file) because ALL FOUR timers reference it identically;
 * housing it in one sibling timer file would force a cross-timer import
 * or a duplicated const, either of which risks the const drifting between
 * timers on a future edit (design-review finding, #728).
 */

export function padTwo(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0')
}

export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${padTwo(m)}:${padTwo(s)}`
}

// Compact human-readable duration for EMOM/Tabata interval labels —
// "1 min" for whole-minute multiples, "{N} s" for sub-minute, "M:SS" for
// mixed values like 90 s (renders as "1:30 min").
export function formatIntervalDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0 s'
  if (totalSeconds < 60) return `${totalSeconds} s`
  if (totalSeconds % 60 === 0) {
    const minutes = totalSeconds / 60
    return `${minutes} min`
  }
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${padTwo(s)} min`
}

// Pre-roll seconds counted down before the first round starts. Gives the
// user a brief "GET READY" window after tapping play, before the actual
// EMOM/Tabata interval begins. Only applied at the very start — once the
// user has worked through a round (or skipped it via the icon controls),
// prep does not return on subsequent pauses/resumes.
//
// Referenced by AmrapTimer, EmomTimer, TabataTimer, and ForTimeTimer.
export const PREP_SECONDS = 10
