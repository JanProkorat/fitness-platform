import React, { useEffect, useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import type { MeasurementDto } from '@/api/measurements'

interface WeightHistoryListProps {
  entries: MeasurementDto[]
}

interface WeightRow {
  measurementId: string
  weight: number
  date: string
  isStart: boolean
  delta: number | null
  isToday: boolean
}

function formatDateCZ(isoStr: string): string {
  const d = new Date(isoStr)
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`
}

function isTodayCZ(isoStr: string): boolean {
  const d = new Date(isoStr)
  const now = new Date()
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  )
}

/** Animated row with staggered fade-in + slide-up. */
function AnimatedRow({
  index,
  children,
}: {
  index: number
  children: React.ReactNode
}) {
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withDelay(
      index * 50,
      withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
    )
  }, [index, progress])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 8 }],
  }))

  return <Animated.View style={animatedStyle}>{children}</Animated.View>
}

export function WeightHistoryList({ entries }: WeightHistoryListProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  const rows: WeightRow[] = useMemo(() => {
    // Filter to weight-only entries, sort ascending by date
    const withWeight = entries
      .filter((e): e is MeasurementDto & { weightKg: number } => e.weightKg != null)
      .sort(
        (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime(),
      )

    if (withWeight.length === 0) return []

    // Build rows in reverse (newest first) with deltas
    const result: WeightRow[] = []
    for (let i = withWeight.length - 1; i >= 0; i--) {
      const entry = withWeight[i]
      const prevEntry = i > 0 ? withWeight[i - 1] : null
      const isStart = i === 0
      const delta = prevEntry ? entry.weightKg - prevEntry.weightKg : null

      result.push({
        measurementId: entry.measurementId,
        weight: entry.weightKg,
        date: entry.measuredAt,
        isStart,
        delta,
        isToday: isTodayCZ(entry.measuredAt),
      })
    }
    return result
  }, [entries])

  if (rows.length === 0) {
    return (
      <View style={[styles.emptyCard, { backgroundColor: colors.bg2 }]}>
        <Text style={[Type.subheadline, { color: colors.label3, textAlign: 'center' }]}>
          {t('profile.noWeightRecords')}
        </Text>
      </View>
    )
  }

  return (
    <View style={[styles.list, { backgroundColor: colors.bg2 }]}>
      {rows.map((row, idx) => {
        const isLast = idx === rows.length - 1
        const deltaColor = row.delta != null && row.delta <= 0 ? colors.green : colors.red
        const deltaSign = row.delta != null ? (row.delta < 0 ? '↓' : row.delta > 0 ? '↑' : '') : ''
        const deltaAbs = row.delta != null ? Math.abs(row.delta).toFixed(1).replace('.', ',') : ''

        return (
          <AnimatedRow key={row.measurementId} index={idx}>
            <View
              style={[
                styles.row,
                !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.sep2 },
              ]}
            >
              {/* Icon */}
              <View style={[styles.icon, { backgroundColor: colors.goldBg }]}>
                <Text style={styles.iconEmoji}>⚖️</Text>
              </View>

              {/* Body */}
              <View style={styles.body}>
                <Text style={[styles.rowTitle, { color: colors.label }]}>
                  {row.weight.toFixed(1).replace('.', ',')} kg
                </Text>
                <Text style={[styles.rowSub, { color: colors.label3 }]}>
                  {formatDateCZ(row.date)}
                  {row.isToday ? ` · ${t('profile.today')}` : ''}
                </Text>
              </View>

              {/* Right: delta or "Start" */}
              <View style={styles.right}>
                {row.isStart ? (
                  <Text style={[styles.startLabel, { color: colors.label3 }]}>
                    {t('profile.start')}
                  </Text>
                ) : row.delta != null ? (
                  <Text style={[styles.deltaText, { color: deltaColor }]}>
                    {deltaSign} {deltaAbs}
                  </Text>
                ) : null}
              </View>
            </View>
          </AnimatedRow>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  list: {
    marginHorizontal: 16,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  emptyCard: {
    marginHorizontal: 16,
    borderRadius: Radius.md,
    padding: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconEmoji: {
    fontSize: 18,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    ...Type.body,
    fontWeight: '500',
  },
  rowSub: {
    ...Type.caption1,
    marginTop: 1,
  },
  right: {
    marginLeft: 8,
    alignItems: 'flex-end',
  },
  deltaText: {
    ...Type.footnote,
    fontWeight: '600',
  },
  startLabel: {
    ...Type.footnote,
    fontWeight: '500',
  },
})

export default WeightHistoryList
