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

const CHART_HEIGHT = 140
const VALUE_LABEL_SPACE = 18

function formatWeight(value: number): string {
  return value.toFixed(1).replace('.', ',')
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

  // Scale: include target weight (if present) so the target line stays in view.
  // Pad the range so top-value labels don't overflow and bars never sit at 0%.
  const weights = entries.map((e) => e.weight)
  const allValues = targetWeight != null ? [...weights, targetWeight] : weights
  const rawMin = Math.min(...allValues)
  const rawMax = Math.max(...allValues)
  const pad = Math.max((rawMax - rawMin) * 0.25, 0.5)
  const chartMin = rawMin - pad
  const chartMax = rawMax + pad
  const chartRange = chartMax - chartMin || 1

  const targetPct =
    targetWeight != null ? (targetWeight - chartMin) / chartRange : null

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
              {weightDelta < 0 ? '↓' : '↑'} {Math.abs(weightDelta).toFixed(1).replace('.', ',')}
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
              {t('profile.goal')}: {formatWeight(targetWeight)} kg · {t('profile.remaining')}: {formatWeight(remaining)} kg
            </Text>
          )}
        </View>
      )}

      {/* Bar chart */}
      <View style={styles.chart}>
        {/* Target weight line (absolute across chart) */}
        {targetPct != null && (
          <View
            pointerEvents="none"
            style={[
              styles.targetLine,
              { bottom: `${targetPct * 100}%`, borderColor: colors.green },
            ]}
          >
            <View
              style={[
                styles.targetLabelBadge,
                { backgroundColor: colors.green },
              ]}
            >
              <Text style={[styles.targetLabelText, { color: colors.bg2 }]}>
                {t('profile.goal')} {formatWeight(targetWeight!)}
              </Text>
            </View>
          </View>
        )}

        {entries.map((entry, idx) => {
          const isLast = idx === entries.length - 1
          const heightPct = (entry.weight - chartMin) / chartRange
          return (
            <View key={entry.date} style={styles.barWrapper}>
              <View
                style={[
                  styles.bar,
                  {
                    height: `${heightPct * 100}%`,
                    backgroundColor: isLast ? colors.gold : colors.fill,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.barValue,
                    { color: isLast ? colors.label : colors.label2 },
                  ]}
                  numberOfLines={1}
                >
                  {formatWeight(entry.weight)}
                </Text>
              </View>
            </View>
          )
        })}
      </View>

      {/* Date labels row (kept outside chart so bars align cleanly) */}
      <View style={styles.dateRow}>
        {entries.map((entry) => (
          <Text
            key={`date-${entry.date}`}
            style={[styles.barLabel, { color: colors.label3 }]}
            numberOfLines={1}
          >
            {`${new Date(entry.date).getDate()}.${new Date(entry.date).getMonth() + 1}`}
          </Text>
        ))}
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
    marginBottom: 4,
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
    marginBottom: 20,
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
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
    paddingTop: VALUE_LABEL_SPACE,
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
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    position: 'relative',
  },
  barValue: {
    ...Type.caption2,
    fontWeight: '600',
    position: 'absolute',
    top: -VALUE_LABEL_SPACE + 2,
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  targetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderStyle: 'dashed',
    zIndex: 1,
  },
  targetLabelBadge: {
    position: 'absolute',
    right: 0,
    top: -9,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.full,
  },
  targetLabelText: {
    ...Type.caption2,
    fontSize: 10,
    fontWeight: '700',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  barLabel: {
    ...Type.caption2,
    flex: 1,
    textAlign: 'center',
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
