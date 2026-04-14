import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'

interface WeightEntry {
  date: string
  weight: number
}

interface WeightChartProps {
  entries: WeightEntry[]
  currentWeight?: number | null
  weightDelta?: number | null
  /** Client's target weight from onboarding. Shows goal line when set. */
  targetWeight?: number | null
  /** Callback when user taps "View History" */
  onViewHistory?: () => void
  /** Total number of measurement entries */
  entryCount?: number
}

export function WeightBarChart({ entries, currentWeight, weightDelta, targetWeight, onViewHistory, entryCount }: WeightChartProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  if (entries.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
        <Text style={[Type.subheadline, { color: colors.label3 }]}>
          {t('profile.noWeightRecords')}
        </Text>
      </View>
    )
  }

  const weights = entries.map((e) => e.weight)
  const minW = Math.min(...weights)
  const maxW = Math.max(...weights)
  const range = maxW - minW || 1

  // Goal progress
  const remaining = currentWeight != null && targetWeight != null
    ? currentWeight - targetWeight
    : null
  const goalReached = remaining != null && remaining <= 0

  return (
    <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          {currentWeight != null && (
            <Text style={[styles.currentWeight, { color: colors.label }]}>
              {currentWeight.toFixed(1)} kg
            </Text>
          )}
        </View>
        {weightDelta != null && weightDelta !== 0 && (
          <View
            style={[
              styles.deltaBadge,
              { backgroundColor: weightDelta < 0 ? colors.green + '20' : colors.red + '20' },
            ]}
          >
            <Text
              style={[
                styles.deltaText,
                { color: weightDelta < 0 ? colors.green : colors.red },
              ]}
            >
              {weightDelta > 0 ? '+' : ''}{weightDelta.toFixed(1)} kg
            </Text>
          </View>
        )}
      </View>

      {/* Goal sub-header */}
      {targetWeight != null && remaining != null && (
        <View style={styles.goalRow}>
          {goalReached ? (
            <View style={[styles.goalBadge, { backgroundColor: colors.green + '20' }]}>
              <Text style={[styles.goalBadgeText, { color: colors.green }]}>
                {t('profile.goalReached')}
              </Text>
            </View>
          ) : (
            <Text style={[styles.goalText, { color: colors.label3 }]}>
              {t('profile.goal')}: {targetWeight.toFixed(1).replace('.', ',')} kg · {t('profile.remaining')}: {remaining.toFixed(1).replace('.', ',')} kg
            </Text>
          )}
        </View>
      )}

      {/* Bar chart */}
      <View style={styles.chart}>
        {entries.map((entry, idx) => {
          const isLast = idx === entries.length - 1
          const heightPct = ((entry.weight - minW) / range) * 0.7 + 0.3
          return (
            <View key={entry.date} style={styles.barWrapper}>
              <View
                style={[
                  styles.bar,
                  {
                    height: `${heightPct * 100}%`,
                    backgroundColor: isLast ? colors.gold : colors.fill,
                    borderRadius: 4,
                  },
                ]}
              />
              <Text style={[styles.barLabel, { color: colors.label3 }]}>
                {`${new Date(entry.date).getDate()}.${new Date(entry.date).getMonth() + 1}`}
              </Text>
            </View>
          )
        })}
      </View>

      {/* View history button */}
      {onViewHistory && (
        <Pressable
          onPress={onViewHistory}
          style={({ pressed }) => [
            styles.historyBtn,
            { backgroundColor: colors.fill, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="time-outline" size={18} color={colors.label2} />
          <Text style={[styles.historyBtnText, { color: colors.label }]}>
            {t('profile.viewHistory')}
          </Text>
          {entryCount != null && (
            <Text style={[styles.historyBtnCount, { color: colors.label3 }]}>
              {entryCount}
            </Text>
          )}
          <Ionicons name="chevron-forward" size={16} color={colors.label3} />
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    padding: 16,
    marginHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  currentWeight: {
    ...Type.title1,
  },
  deltaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  deltaText: {
    ...Type.caption1,
    fontWeight: '600',
  },
  goalRow: {
    marginTop: -8,
    marginBottom: 12,
  },
  goalText: {
    ...Type.caption1,
  },
  goalBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  goalBadgeText: {
    ...Type.caption1,
    fontWeight: '600',
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 100,
    gap: 6,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    minHeight: 4,
  },
  barLabel: {
    ...Type.caption2,
    marginTop: 4,
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: Radius.sm,
    marginTop: 14,
    gap: 10,
  },
  historyBtnText: {
    ...Type.body,
    flex: 1,
  },
  historyBtnCount: {
    ...Type.caption1,
  },
})

export default WeightBarChart
