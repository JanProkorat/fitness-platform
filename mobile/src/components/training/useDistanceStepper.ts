/**
 * useDistanceStepper — distance state + inc/dec/done steppers for
 * TimedExerciseFocus's Distance-movement mode.
 *
 * Extracted verbatim from TimedExerciseFocus (behavior-preserving refactor —
 * see #728).
 */

import { useCallback, useEffect, useState } from 'react'
import { decrementDistance, incrementDistance } from './timedExerciseHelpers'

export interface UseDistanceStepperParams {
  plannedDistanceMeters: number
  currentSet: number
  onSetDone: (durationSeconds?: number, distanceMeters?: number) => void
}

export interface UseDistanceStepperResult {
  distanceMeters: number
  handleDistanceDec: () => void
  handleDistanceInc: () => void
  handleDistanceDone: () => void
}

export function useDistanceStepper({
  plannedDistanceMeters,
  currentSet,
  onSetDone,
}: UseDistanceStepperParams): UseDistanceStepperResult {
  const [distanceMeters, setDistanceMeters] = useState(plannedDistanceMeters)

  useEffect(() => {
    setDistanceMeters(plannedDistanceMeters)
  }, [plannedDistanceMeters, currentSet])

  const handleDistanceDec = useCallback(
    () => setDistanceMeters((d) => decrementDistance(d)),
    [],
  )
  const handleDistanceInc = useCallback(
    () => setDistanceMeters((d) => incrementDistance(d)),
    [],
  )

  const handleDistanceDone = useCallback(() => {
    onSetDone(undefined, distanceMeters)
  }, [onSetDone, distanceMeters])

  return {
    distanceMeters,
    handleDistanceDec,
    handleDistanceInc,
    handleDistanceDone,
  }
}
