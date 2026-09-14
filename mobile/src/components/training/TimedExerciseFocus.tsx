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

import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Radius } from '@/constants/radius'
import { useTranslation } from 'react-i18next'
import type { MovementType } from '@/api/wod-types'
import { ExerciseFocusHero, type SetStatus } from '@/components/training/ExerciseFocusHero'
import { useCountdownTimer } from '@/components/training/useCountdownTimer'
import { useDistanceStepper } from '@/components/training/useDistanceStepper'
import { formatCountdown } from '@/components/training/timedExerciseHelpers'

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

  const { timerRunning, remaining, handleStartTimer, handlePauseTimer, handleFinishTimer } =
    useCountdownTimer({ plannedDurationSeconds, currentSet, onSetDone })

  const { distanceMeters, handleDistanceDec, handleDistanceInc, handleDistanceDone } =
    useDistanceStepper({ plannedDistanceMeters, currentSet, onSetDone })

  const isTime = movementType === 'Time'

  return (
    <>
      {/* Exercise hero */}
      <ExerciseFocusHero
        exerciseName={exerciseName}
        muscleColor={muscleColor}
        muscleLabel={muscleLabel}
        exerciseIndex={exerciseIndex}
        exerciseTotal={exerciseTotal}
        currentSet={currentSet}
        totalSets={totalSets}
        setStatuses={setStatuses}
        onGoToSet={onGoToSet}
      />

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
