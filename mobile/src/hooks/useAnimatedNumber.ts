import { useEffect, useRef, useState } from 'react'

const DEFAULT_DURATION_MS = 400

// Ease-out cubic — smooth deceleration, feels natural for counter transitions.
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Smoothly tweens a numeric value to a target over `duration` ms using
 * `requestAnimationFrame`. Safe across value changes mid-animation (picks up
 * from the current displayed value instead of snapping). Returns the current
 * interpolated value — the caller decides how to round/format it for display.
 *
 * Intended for relatively short animations (200–600 ms) on infrequently
 * changing values. Each frame causes a re-render of whichever component uses
 * the returned number, so keep the tree around it small.
 */
export function useAnimatedNumber(value: number, duration: number = DEFAULT_DURATION_MS): number {
  const [display, setDisplay] = useState(value)
  const rafRef = useRef<number | null>(null)
  // Keep latest display in a ref so the effect can read it without depending
  // on `display` (which would restart the animation every frame).
  const displayRef = useRef(display)
  displayRef.current = display

  useEffect(() => {
    const from = displayRef.current
    const to = value
    if (from === to) return

    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const t = Math.min(1, elapsed / duration)
      const eased = easeOutCubic(t)
      const next = from + (to - from) * eased
      setDisplay(next)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [value, duration])

  return display
}

export default useAnimatedNumber
