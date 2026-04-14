import React, { useEffect } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'

interface WeightEntry {
  date: string
  weight: number
}

interface WeightStatCardProps {
  /** Most recent weight in kg, or null if no data */
  latestWeight: number | null
  /** Weight change over 30 days (positive = gain) */
  weightDelta: number | null
  /** Recent weight entries for sparkline (last 7 used) */
  entries: WeightEntry[]
}

/** Animated sparkline bar with staggered fade-in + grow effect. */
function SparkBar({
  heightPct,
  color,
  delay,
}: {
  heightPct: number
  color: string
  delay: number
}) {
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) }),
    )
  }, [delay, progress])

  const animatedStyle = useAnimatedStyle(() => ({
    height: `${heightPct * 100 * progress.value}%`,
    opacity: progress.value,
  }))

  return (
    <Animated.View
      style={[
        styles.sparkBar,
        { backgroundColor: color, minHeight: 3 },
        animatedStyle,
      ]}
    />
  )
}

export const WeightStatCard = React.memo(function WeightStatCard({
  latestWeight,
  weightDelta,
  entries,
}: WeightStatCardProps) {
  const colors = useTheme()
  const { t } = useTranslation()
  const router = useRouter()

  const hasData = latestWeight != null
  const deltaColor =
    weightDelta != null
      ? weightDelta <= 0
        ? colors.green
        : colors.orange
      : undefined

  const deltaText =
    weightDelta != null
      ? `${weightDelta < 0 ? '↓' : weightDelta > 0 ? '↑' : ''} ${Math.abs(weightDelta).toFixed(1).replace('.', ',')} kg`
      : hasData
        ? null
        : t('today.noMeasurements')

  // Sparkline data: take last 7 entries
  const sparkData = entries.slice(-7)
  const sparkWeights = sparkData.map((e) => e.weight)
  const sparkMin = sparkWeights.length > 0 ? Math.min(...sparkWeights) : 0
  const sparkMax = sparkWeights.length > 0 ? Math.max(...sparkWeights) : 1
  const sparkRange = sparkMax - sparkMin || 1

  return (
    <Pressable
      onPress={() => router.push('/(client)/(tabs)/profile')}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.bg2, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: colors.label2 }]}>{t('today.weight')}</Text>
        <Text style={styles.icon}>⚖️</Text>
      </View>

      {/* Value */}
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: colors.label }]}>
          {hasData ? latestWeight.toFixed(1).replace('.', ',') : '—'}
        </Text>
        {hasData && (
          <Text style={[styles.unit, { color: colors.label2 }]}>kg</Text>
        )}
      </View>

      {/* Delta */}
      {deltaText != null && (
        <Text style={[styles.delta, { color: deltaColor ?? colors.label3 }]}>
          {deltaText}
        </Text>
      )}

      {/* Sparkline with staggered animation */}
      {sparkData.length >= 2 && (
        <View style={styles.sparkline}>
          {sparkData.map((entry, idx) => {
            const isLast = idx === sparkData.length - 1
            const heightPct = ((entry.weight - sparkMin) / sparkRange) * 0.7 + 0.2
            return (
              <SparkBar
                key={entry.date}
                heightPct={heightPct}
                color={isLast ? colors.gold : colors.fill}
                delay={idx * 60}
              />
            )
          })}
        </View>
      )}
    </Pressable>
  )
})

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Radius.md,
    padding: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    ...Type.caption2,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  icon: {
    fontSize: 14,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    ...Type.title2,
  },
  unit: {
    ...Type.caption1,
  },
  delta: {
    ...Type.caption2,
    fontWeight: '600',
    marginTop: 2,
  },
  sparkline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 20,
    marginTop: 6,
  },
  sparkBar: {
    flex: 1,
    borderRadius: 2,
  },
})

export default WeightStatCard
