/**
 * ExerciseFocusHero — presentational hero card for TimedExerciseFocus:
 * muscle line, exercise name, set counter badge, set-status dots row.
 *
 * Extracted verbatim from TimedExerciseFocus (behavior-preserving refactor —
 * see #728). Styles are split unchanged from the original shared StyleSheet.
 */

import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { useTranslation } from 'react-i18next'

// Shared set-status type mirrors LiveExerciseFocus / TimedExerciseFocus
export type SetStatus = 'done' | 'active' | 'skipped' | 'pending'

export interface ExerciseFocusHeroProps {
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
  onGoToSet: (idx: number) => void
}

export function ExerciseFocusHero({
  exerciseName,
  muscleColor,
  muscleLabel,
  exerciseIndex,
  exerciseTotal,
  currentSet,
  totalSets,
  setStatuses,
  onGoToSet,
}: ExerciseFocusHeroProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  return (
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
})

export default ExerciseFocusHero
