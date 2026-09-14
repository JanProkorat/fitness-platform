import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'

interface BodyPartProgressBarProps {
  label: string
  color: string
  done: number
  total: number
}

/**
 * A single body-part progress bar rendered inside the DaySummaryHero card
 * (white background). Label + count read in theme tokens; the fill colour
 * comes from the muscle-group palette via the `color` prop.
 */
export function BodyPartProgressBar({ label, color, done, total }: BodyPartProgressBarProps) {
  const colors = useTheme()
  const ratio = total > 0 ? Math.min(done / total, 1) : 0

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.label2 }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.track, { backgroundColor: colors.fill2 }]}>
        <View style={[styles.fill, { width: `${ratio * 100}%` as `${number}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.count, { color: colors.label2 }]}>
        {done}/{total}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    minWidth: 80,
  },
  track: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: 5,
    borderRadius: 3,
  },
  count: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 0,
    minWidth: 28,
    textAlign: 'right',
  },
})

export default BodyPartProgressBar
