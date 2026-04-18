import React, { useCallback } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { useTranslation } from 'react-i18next'

type SetStatus = 'done' | 'active' | 'skipped' | 'pending'

export interface LiveExerciseFocusProps {
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
  /** Actual reps value in the stepper */
  reps: number
  /** Planned reps (shown as hint) */
  plannedReps: number
  /** Actual weight in the stepper (0 = bodyweight) */
  weightKg: number
  /** Planned weight (0 = bodyweight) */
  plannedWeightKg: number
  onRepsChange: (delta: number) => void
  onWeightChange: (delta: number) => void
  onSetDone: () => void
  onSkipSet: () => void
  onSkipExercise: () => void
  onGoToSet: (idx: number) => void
}

/**
 * Hero card for the current exercise during a live session.
 * Contains: muscle dot, exercise name, SÉRIE badge, set dots,
 * reps/weight +/- steppers, and primary gold "SÉRIE HOTOVA" button.
 */
export function LiveExerciseFocus({
  exerciseName,
  muscleColor,
  muscleLabel,
  exerciseIndex,
  exerciseTotal,
  currentSet,
  totalSets,
  setStatuses,
  reps,
  plannedReps,
  weightKg,
  plannedWeightKg,
  onRepsChange,
  onWeightChange,
  onSetDone,
  onSkipSet,
  onSkipExercise,
  onGoToSet,
}: LiveExerciseFocusProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  const isBodyweight = plannedWeightKg === 0

  const handleRepsDown = useCallback(() => onRepsChange(-1), [onRepsChange])
  const handleRepsUp = useCallback(() => onRepsChange(1), [onRepsChange])
  const handleWeightDown = useCallback(() => onWeightChange(-2.5), [onWeightChange])
  const handleWeightUp = useCallback(() => onWeightChange(2.5), [onWeightChange])

  return (
    <>
      {/* Exercise hero */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: colors.bg2,
            borderColor: colors.sep2,
          },
        ]}
      >
        <View style={styles.heroTop}>
          <View style={styles.heroLeft}>
            {/* Muscle dot + label */}
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
                status === 'active' && {
                  backgroundColor: colors.gold + '8c',
                },
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
        <View style={styles.steppersRow}>
          {/* Reps stepper */}
          <View style={styles.stepperWrap}>
            <Text style={[styles.stepperTitle, { color: colors.label3 }]}>
              {t('training.live.repsLabel')}
            </Text>
            <View
              style={[
                styles.stepper,
                { backgroundColor: colors.bg, borderColor: colors.sep },
              ]}
            >
              <Pressable
                style={styles.stepperBtn}
                onPress={handleRepsDown}
                accessibilityLabel={t('training.live.decreaseReps')}
              >
                <Text style={[styles.stepperBtnText, { color: colors.label2 }]}>−</Text>
              </Pressable>
              <Text style={[styles.stepperValue, { color: colors.gold }]}>{reps}</Text>
              <Pressable
                style={styles.stepperBtn}
                onPress={handleRepsUp}
                accessibilityLabel={t('training.live.increaseReps')}
              >
                <Text style={[styles.stepperBtnText, { color: colors.label2 }]}>+</Text>
              </Pressable>
            </View>
            <Text style={[styles.stepperHint, { color: colors.label3 }]}>
              {t('training.live.planHint')}{' '}
              <Text style={{ color: colors.label2, fontWeight: '600' }}>{plannedReps}</Text>
            </Text>
          </View>

          {/* Weight stepper */}
          <View style={styles.stepperWrap}>
            <Text style={[styles.stepperTitle, { color: colors.label3 }]}>
              {isBodyweight
                ? t('training.live.bodweightLabel')
                : t('training.live.weightLabel')}
            </Text>
            <View
              style={[
                styles.stepper,
                { backgroundColor: colors.bg, borderColor: colors.sep },
                isBodyweight && styles.stepperDisabled,
              ]}
              pointerEvents={isBodyweight ? 'none' : 'auto'}
            >
              <Pressable
                style={styles.stepperBtn}
                onPress={handleWeightDown}
                disabled={isBodyweight}
                accessibilityLabel={t('training.live.decreaseWeight')}
              >
                <Text style={[styles.stepperBtnText, { color: colors.label2 }]}>−</Text>
              </Pressable>
              <Text style={[styles.stepperValue, { color: colors.gold }]}>
                {isBodyweight ? t('training.live.bw') : weightKg}
              </Text>
              <Pressable
                style={styles.stepperBtn}
                onPress={handleWeightUp}
                disabled={isBodyweight}
                accessibilityLabel={t('training.live.increaseWeight')}
              >
                <Text style={[styles.stepperBtnText, { color: colors.label2 }]}>+</Text>
              </Pressable>
            </View>
            {!isBodyweight && (
              <Text style={[styles.stepperHint, { color: colors.label3 }]}>
                {t('training.live.planHint')}{' '}
                <Text style={{ color: colors.label2, fontWeight: '600' }}>
                  {plannedWeightKg} kg
                </Text>
              </Text>
            )}
          </View>
        </View>

        {/* Primary action */}
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: colors.gold }]}
          onPress={onSetDone}
        >
          <Text style={[styles.primaryBtnText, { color: colors.onAccent }]}>
            {t('training.live.seriesDone')}
          </Text>
        </Pressable>

        {/* Secondary actions */}
        <View style={styles.secondaryRow}>
          <Pressable onPress={onSkipSet} style={styles.secondaryBtn}>
            <Text style={[styles.secondaryBtnText, { color: colors.label3 }]}>
              {t('training.live.skipSet')}
            </Text>
          </Pressable>
          <Text style={[styles.dot, { color: colors.label3 }]}>·</Text>
          <Pressable onPress={onSkipExercise} style={styles.secondaryBtn}>
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
  steppersRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  stepperWrap: {
    flex: 1,
  },
  stepperTitle: {
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
  stepperDisabled: {
    opacity: 0.45,
  },
  stepperBtn: {
    width: 40,
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
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  stepperHint: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 6,
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
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 4,
  },
  secondaryBtn: {
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

export default LiveExerciseFocus
