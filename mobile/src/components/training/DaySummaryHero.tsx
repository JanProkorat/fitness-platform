import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable, type LayoutChangeEvent } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import type { MuscleGroup } from '@/api/training'
import { getMuscleGroupColor } from '@/constants/muscleGroups'
import { BodyPartProgressBar } from './BodyPartProgressBar'

const ANIM_DURATION = 260
const easing = Easing.out(Easing.cubic)

export interface BodyPartEntry {
  mg: MuscleGroup
  done: number
  total: number
}

interface DaySummaryHeroProps {
  sessionsCount: number
  exercisesCount: number
  bodyParts: BodyPartEntry[]
  completedSessions: number
  completedExercises: number
}

/**
 * Blue gradient hero card for the training day summary.
 * Uses the grad-push palette (#1a1a2e → #16213e) committed in the prototype.
 */
export function DaySummaryHero({
  sessionsCount,
  exercisesCount,
  bodyParts,
  completedSessions,
  completedExercises,
}: DaySummaryHeroProps) {
  const colors = useTheme()
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  // Measured height of the collapsible block — captured once on first layout so
  // we can drive height manually without unmounting (avoids the clipped-exit jank).
  const [contentHeight, setContentHeight] = useState<number | null>(null)

  // progress: 1 = expanded, 0 = collapsed. Same value drives height, opacity,
  // and chevron rotation so both directions feel identical.
  const progress = useSharedValue(0)

  const contentStyle = useAnimatedStyle(() => ({
    height: contentHeight != null ? progress.value * contentHeight : undefined,
    opacity: progress.value,
  }))
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }))

  const handleContentLayout = (e: LayoutChangeEvent) => {
    if (contentHeight == null) setContentHeight(e.nativeEvent.layout.height)
  }

  const toggleExpanded = () => {
    const next = !expanded
    progress.value = withTiming(next ? 1 : 0, { duration: ANIM_DURATION, easing })
    setExpanded(next)
  }

  const sessionsRatio =
    sessionsCount > 0 ? Math.min(completedSessions / sessionsCount, 1) : 0
  const exercisesRatio =
    exercisesCount > 0 ? Math.min(completedExercises / exercisesCount, 1) : 0

  return (
    <LinearGradient
      // grad-push palette from prototype — semantic training domain colors
      colors={['#1a1a2e', '#16213e']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Header: "Daily overview" label · chevron — tap to expand/collapse */}
      <Pressable
        onPress={toggleExpanded}
        style={styles.topRow}
        hitSlop={8}
      >
        <Text style={styles.heading}>{t('nutrition.dailyOverview')}</Text>
        <Animated.View style={[styles.chevron, chevronStyle]}>
          <Ionicons
            name="chevron-down"
            size={16}
            color="rgba(255,255,255,0.6)"
          />
        </Animated.View>
      </Pressable>

      {/* Collapsible content — only body parts collapse */}
      <Animated.View style={[styles.collapsibleWrap, contentStyle]}>
        <View onLayout={handleContentLayout}>
          {bodyParts.length > 0 && (
            <View style={styles.bodyPartsWrap}>
              {bodyParts.map(({ mg, done, total }) => (
                <BodyPartProgressBar
                  key={mg}
                  label={t(`muscleGroup.${mg}`)}
                  color={getMuscleGroupColor(mg, colors)}
                  done={done}
                  total={total}
                />
              ))}
            </View>
          )}
        </View>
      </Animated.View>

      {/* Progress bars: label · track · count — sessions above, exercises below */}
      <View style={styles.overallRow}>
        <Text style={styles.overallLabel}>{t('training.sessionsLabel')}</Text>
        <View style={styles.overallTrack}>
          <View
            style={[
              styles.overallFill,
              { width: `${Math.round(sessionsRatio * 100)}%` as `${number}%`, backgroundColor: colors.gold },
            ]}
          />
        </View>
        <Text style={styles.overallLabel}>
          {t('training.completedRatio', {
            done: completedSessions,
            total: sessionsCount,
          })}
        </Text>
      </View>
      <View style={[styles.overallRow, styles.overallRowStacked]}>
        <Text style={styles.overallLabel}>{t('training.exercisesLabel')}</Text>
        <View style={styles.overallTrack}>
          <View
            style={[
              styles.overallFill,
              { width: `${Math.round(exercisesRatio * 100)}%` as `${number}%`, backgroundColor: colors.gold },
            ]}
          />
        </View>
        <Text style={styles.overallLabel}>
          {t('training.completedRatio', {
            done: completedExercises,
            total: exercisesCount,
          })}
        </Text>
      </View>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  heading: {
    ...Type.subheadline,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  chevron: {
    marginLeft: 8,
  },
  collapsibleWrap: {
    overflow: 'hidden',
  },
  bodyPartsWrap: {
    gap: 6,
    marginBottom: 10,
  },
  overallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overallRowStacked: {
    marginTop: 8,
  },
  overallTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  overallFill: {
    height: 6,
    borderRadius: 3,
  },
  overallLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    flexShrink: 0,
  },
})

export default DaySummaryHero
