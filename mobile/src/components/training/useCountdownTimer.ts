/**
 * useCountdownTimer — timer state/refs/interval + start/pause/finish handlers
 * for TimedExerciseFocus's Time-movement mode.
 *
 * Extracted verbatim from TimedExerciseFocus (behavior-preserving refactor —
 * see #728). The interval cadence (250ms), the wall-clock elapsed calc via
 * startedAtRef, and the finish-timer duration math are unchanged.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { computeFinishTimerDuration } from './timedExerciseHelpers'

export interface UseCountdownTimerParams {
  plannedDurationSeconds: number
  currentSet: number
  onSetDone: (durationSeconds?: number, distanceMeters?: number) => void
}

export interface UseCountdownTimerResult {
  timerRunning: boolean
  remaining: number
  handleStartTimer: () => void
  handlePauseTimer: () => void
  handleFinishTimer: () => void
}

export function useCountdownTimer({
  plannedDurationSeconds,
  currentSet,
  onSetDone,
}: UseCountdownTimerParams): UseCountdownTimerResult {
  const [timerRunning, setTimerRunning] = useState(false)
  const [remaining, setRemaining] = useState(plannedDurationSeconds)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef<number | null>(null)

  // Reset when the planned duration changes (next set)
  useEffect(() => {
    setRemaining(plannedDurationSeconds)
    setTimerRunning(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    startedAtRef.current = null
  }, [plannedDurationSeconds, currentSet])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const handleStartTimer = useCallback(() => {
    if (timerRunning) return
    startedAtRef.current = Date.now()
    setTimerRunning(true)
    timerRef.current = setInterval(() => {
      if (startedAtRef.current === null) return
      const elapsed = (Date.now() - startedAtRef.current) / 1000
      const rem = plannedDurationSeconds - elapsed
      if (rem <= 0) {
        setRemaining(0)
        setTimerRunning(false)
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        onSetDone(plannedDurationSeconds, undefined)
      } else {
        setRemaining(rem)
      }
    }, 250)
  }, [timerRunning, plannedDurationSeconds, onSetDone])

  const handlePauseTimer = useCallback(() => {
    if (!timerRunning) return
    setTimerRunning(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (startedAtRef.current !== null) {
      const elapsed = (Date.now() - startedAtRef.current) / 1000
      setRemaining((r) => Math.max(0, r - elapsed))
      startedAtRef.current = null
    }
  }, [timerRunning])

  const handleFinishTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    setTimerRunning(false)
    const duration = computeFinishTimerDuration({
      timerRunning,
      remaining,
      plannedDurationSeconds,
      startedAt: startedAtRef.current,
      now: Date.now(),
    })
    onSetDone(duration, undefined)
  }, [timerRunning, remaining, plannedDurationSeconds, onSetDone])

  return {
    timerRunning,
    remaining,
    handleStartTimer,
    handlePauseTimer,
    handleFinishTimer,
  }
}
