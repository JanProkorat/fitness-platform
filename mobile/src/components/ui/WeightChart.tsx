import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
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
}

export function WeightChart({ entries, currentWeight, weightDelta }: WeightChartProps) {
  const colors = useTheme()

  if (entries.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
        <Text style={[Type.headline, { color: colors.label }]}>Weight</Text>
        <Text style={[Type.subheadline, { color: colors.label3, marginTop: 8 }]}>
          No measurements yet
        </Text>
      </View>
    )
  }

  const weights = entries.map((e) => e.weight)
  const minW = Math.min(...weights)
  const maxW = Math.max(...weights)
  const range = maxW - minW || 1

  return (
    <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[Type.headline, { color: colors.label2 }]}>Weight</Text>
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
                {new Date(entry.date).getDate()}
              </Text>
            </View>
          )
        })}
      </View>
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
    marginTop: 4,
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
})

export default WeightChart
