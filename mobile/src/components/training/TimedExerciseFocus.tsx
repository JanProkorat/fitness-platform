/**
 * TimedExerciseFocus — hero card for Time and Distance movement types.
 *
 * Exposes the same external API signature as LiveExerciseFocus so the
 * parent screen can render either component based on the exercise's
 * MovementType without branching on internal layout concerns.
 *
 * - MovementType === 'Time':     count-down from durationSeconds to 0.
 *   On expiry calls onSetDone with the planned duration.
 * - MovementType === 'Distance': numeric distance stepper; +/- 10 m.
 *   Calls onSetDone with the entered distance.
 *
 * Timer state is owned locally (not in the store) because time-display
 * ticks every second and should not trigger store writes. Only the
 * final value goes to the store via onSetDone.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { useTranslation } from 'react-i18next'
import type { MovementType } from '@/api/wod-types'

// Shared set-status type mirrors LiveExerciseFocus
type SetStatus = 'done' | 'active' | 'skipped' | 'pending'

export interface TimedExerciseFocusProps {
  /** Display name of the current exercise */
  exerciseName: string
  /** Small dot color corresponding to the muscle group */
  muscleColor: string
  /** Muscle group label, e.g. "Hrudník" */
  muscleLabel: string
  /** 1-based index of this exercise in the session */
  exerciseIndex: number
  /** Total number of exercises in the session */
  exerciseTotal: number
  /** 1-based current set number */
  currentSet: number
  /** Total sets for this exercise */
  totalSets: number
  /** Per-set status array (length = totalSets) */
  setStatuses: SetStatus[]
  /** Movement type — Time or Distance */
  movementType: MovementType
  /** Planned duration in seconds (for Time movements) */
  plannedDurationSeconds: number
  /** Planned distance in meters (for Distance movements) */
  plannedDistanceMeters: number
  onSetDone: (durationSeconds?: number, distanceMeters?: number) => void
  onSkipSet: () => void
  onSkipExercise: () => void
  onGoToSet: (idx: number) => void
}

/**
 * Format seconds as MM:SS.
 */
function formatCountdown(secs: number): string {
  const s = Math.max(0, Math.ceil(secs))
  const m = Math.floor(s / 60)
  const remaining = s % 60
  return `${String(m).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
}

export function TimedExerciseFocus({
  exerciseName,
  muscleColor,
  muscleLabel,
  exerciseIndex,
  exerciseTotal,
  currentSet,
  totalSets,
  setStatuses,
  movementType,
  plannedDurationSeconds,
  plannedDistanceMeters,
  onSetDone,
  onSkipSet,
  onSkipExercise,
  onGoToSet,
}: TimedExerciseFocusProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  // ── Timer state (Time movements) ─────────────────────────────────────────
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
    const elapsed = startedAtRef.current
      ? Math.round((Date.now() - startedAtRef.current) / 1000)
      : Math.round(plannedDurationSeconds - remaining)
    const duration = timerRunning
      ? plannedDurationSeconds - remaining + elapsed
      : plannedDurationSeconds - remaining
    onSetDone(Math.round(duration), undefined)
  }, [timerRunning, remaining, plannedDurationSeconds, onSetDone])

  // ── Distance state ────────────────────────────────────────────────────────
  const [distanceMeters, setDistanceMeters] = useState(plannedDistanceMeters)

  useEffect(() => {
    setDistanceMeters(plannedDistanceMeters)
  }, [plannedDistanceMeters, currentSet])

  const handleDistanceDec = useCallback(
    () => setDistanceMeters((d) => Math.max(0, Math.round((d - 10) * 10) / 10)),
    [],
  )
  const handleDistanceInc = useCallback(
    () => setDistanceMeters((d) => Math.round((d + 10) * 10) / 10),
    [],
  )

  const handleDistanceDone = useCallback(() => {
    onSetDone(undefined, distanceMeters)
  }, [onSetDone, distanceMeters])

  const isTime = movementType === 'Time'

  return (
    <>
      {/* Exercise hero */}
      <View
        style={[
          styles.heroCard,
          { backgroundColor: colors.bg2, borderColor: colors.sep2 },
        ]}
      >
        <View style={styles.heroTop}>
          <View style={styles.heroLeft}>
            <View style={styles.muscleLine}>
              <View style={[styles.muscleDot, { backgroundColor: muscleColor }]} />
              <Text style={[styles.muscleLabel, { color: colors.label2 }]}>
                {muscleLabel} · {t('training.live.exerciseProgress', {
                  current: exerciseIndex,
                  total: exerciseTotal,
                })}
              </Text>
            </View>
            <Text style={[styles.exerciseName, { color: colors.label }]} numberOfLines={2}>
              {exerciseName}
            </Text>
          </View>

          {/* SÉRIE badge */}
          <View
            style={[
              styles.serieBadge,
              { backgroundColor: colors.goldBg, borderColor: colors.gold + '4d' },
            ]}
          >
            <Text style={[styles.serieCurr, { color: colors.gold }]}>{currentSet}</Text>
            <Text style={[styles.serieSlash, { color: colors.label3 }]}>/{totalSets}</Text>
            <Text style={[styles.serieLabel, { color: colors.label3 }]}>
              {t('training.live.seriesLabel')}
            </Text>
          </View>
        </View>

        {/* Set dots */}
        <View style={styles.dotsRow}>
          {setStatuses.map((status, i) => (
            <Pressable
              key={i}
              style={[
                styles.setDot,
                status === 'done' && { backgroundColor: colors.gold },
                status === 'active' && { backgroundColor: colors.gold + '8c' },
                status === 'skipped' && { backgroundColor: colors.label3 },
                status === 'pending' && { backgroundColor: colors.fill },
              ]}
              onPress={() => onGoToSet(i)}
              accessibilityLabel={`${t('training.live.setLabel')} ${i + 1}`}
            />
          ))}
        </View>
      </View>

      {/* Input card */}
      <View
        style={[styles.inputCard, { backgroundColor: colors.bg2, borderColor: colors.sep2 }]}
      >
        {isTime ? (
          /* ── TIME mode ── */
          <>
            {/* Big countdown display */}
            <View style={styles.timerDisplay}>
              <Text style={[styles.timerValue, { color: remaining <= 10 ? colors.red : colors.gold }]}>
                {formatCountdown(remaining)}
              </Text>
              <Text style={[styles.timerHint, { color: colors.label3 }]}>
                {t('training.wod.plannedDuration', { seconds: plannedDurationSeconds })}
              </Text>
            </View>

            {/* Start / Pause button */}
            {!timerRunning ? (
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: colors.gold }]}
                onPress={handleStartTimer}
              >
                <Text style={[styles.primaryBtnText, { color: colors.onAccent }]}>
                  {remaining < plannedDurationSeconds
                    ? t('training.wod.resume')
                    : t('training.wod.startTimer')}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: colors.fill }]}
                onPress={handlePauseTimer}
              >
                <Text style={[styles.primaryBtnText, { color: colors.label }]}>
                  {t('training.wod.pauseTimer')}
                </Text>
              </Pressable>
            )}

            {/* Finish early */}
            <Pressable
              style={[styles.finishEarlyBtn]}
              onPress={handleFinishTimer}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.label3 }]}>
                {t('training.wod.finishNow')}
              </Text>
            </Pressable>
          </>
        ) : (
          /* ── DISTANCE mode ── */
          <>
            <Text style={[styles.distanceTitle, { color: colors.label3 }]}>
              {t('training.wod.distanceMeters')}
            </Text>
            <View
              style={[styles.stepper, { backgroundColor: colors.bg, borderColor: colors.sep }]}
            >
              <Pressable
                style={styles.stepperBtn}
                onPress={handleDistanceDec}
                accessibilityLabel={t('training.wod.decreaseDistance')}
              >
                <Text style={[styles.stepperBtnText, { color: colors.label2 }]}>−</Text>
              </Pressable>
              <Text style={[styles.stepperValue, { color: colors.gold }]}>
                {distanceMeters} m
              </Text>
              <Pressable
                style={styles.stepperBtn}
                onPress={handleDistanceInc}
                accessibilityLabel={t('training.wod.increaseDistance')}
              >
                <Text style={[styles.stepperBtnText, { color: colors.label2 }]}>+</Text>
              </Pressable>
            </View>
            <Text style={[styles.stepperHint, { color: colors.label3 }]}>
              {t('training.live.planHint')}{' '}
              <Text style={{ color: colors.label2, fontWeight: '600' }}>
                {plannedDistanceMeters} m
              </Text>
            </Text>

            <Pressable
              style={[styles.primaryBtn, { backgroundColor: colors.gold, marginTop: 16 }]}
              onPress={handleDistanceDone}
            >
              <Text style={[styles.primaryBtnText, { color: colors.onAccent }]}>
                {t('training.live.seriesDone')}
              </Text>
            </Pressable>
          </>
        )}

        {/* Secondary actions */}
        <View style={styles.secondaryRow}>
          <Pressable onPress={onSkipSet} style={styles.secondaryBtnWrap}>
            <Text style={[styles.secondaryBtnText, { color: colors.label3 }]}>
              {t('training.live.skipSet')}
            </Text>
          </Pressable>
          <Text style={[styles.dot, { color: colors.label3 }]}>·</Text>
          <Pressable onPress={onSkipExercise} style={styles.secondaryBtnWrap}>
            <Text style={[styles.secondaryBtnText, { color: colors.label3 }]}>
              {t('training.live.skipExercise')}
            </Text>
          </Pressable>
        </View>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  heroCard: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: Radius.md,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroLeft: {
    flex: 1,
    minWidth: 0,
  },
  muscleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  muscleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  muscleLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.08 * 11,
  },
  exerciseName: {
    ...Type.title2,
    lineHeight: 26,
  },
  serieBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    flexShrink: 0,
  },
  serieCurr: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 21,
  },
  serieSlash: {
    fontSize: 12,
    fontWeight: '500',
  },
  serieLabel: {
    fontSize: 9,
    letterSpacing: 0.1 * 9,
    marginTop: 2,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
  },
  setDot: {
    flex: 1,
    height: 6,
    borderRadius: 99,
  },
  inputCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  timerDisplay: {
    alignItems: 'center',
    marginBottom: 20,
  },
  timerValue: {
    fontSize: 64,
    fontWeight: '700',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
    lineHeight: 72,
  },
  timerHint: {
    fontSize: 12,
    marginTop: 4,
  },
  primaryBtn: {
    borderRadius: Radius.sm,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  finishEarlyBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  distanceTitle: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.08 * 10,
    textAlign: 'center',
    marginBottom: 8,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    height: 44,
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 52,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 22,
    fontWeight: '500',
  },
  stepperValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  stepperHint: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 6,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 4,
  },
  secondaryBtnWrap: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  secondaryBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dot: {
    fontSize: 12,
  },
})

export default TimedExerciseFocus
