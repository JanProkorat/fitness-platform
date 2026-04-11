import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'

interface MacroBarProps {
  label: string
  current: number
  target: number
  color: string
  unit?: string
  /** Horizontal layout: label | bar | value in a single row (prototype style) */
  horizontal?: boolean
}

export function MacroBar({
  label,
  current,
  target,
  color,
  unit = 'g',
  horizontal = false,
}: MacroBarProps) {
  const colors = useTheme()
  const ratio = target > 0 ? current / target : 0
  const capped = Math.min(ratio, 1)
  const isOver = ratio > 1
  const barColor = isOver ? colors.red : color

  if (horizontal) {
    return (
      <View style={styles.hContainer}>
        <Text style={[styles.hLabel, { color: colors.label2 }]}>{label}</Text>
        <View style={[styles.hTrack, { backgroundColor: colors.fill }]}>
          <View
            style={[
              styles.hFill,
              { width: `${capped * 100}%`, backgroundColor: barColor },
            ]}
          />
        </View>
        <Text style={[styles.hValues, { color: colors.label2 }]}>
          <Text style={styles.hCurrent}>
            {Math.round(current)}
          </Text>
          {target > 0 ? ` / ${Math.round(target)} ${unit}` : ` ${unit}`}
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.label2 }]}>{label}</Text>
        <Text style={[styles.values, { color: colors.label2 }]}>
          <Text style={[styles.current, { color: barColor }]}>
            {Math.round(current)}
          </Text>
          {target > 0 ? ` / ${Math.round(target)}${unit}` : ` ${unit}`}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.fill }]}>
        <View
          style={[
            styles.fill,
            { width: `${capped * 100}%`, backgroundColor: barColor },
          ]}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // ── Stacked (default) ──
  container: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    ...Type.subheadline,
    fontWeight: '500',
  },
  values: {
    ...Type.caption1,
  },
  current: {
    fontWeight: '600',
  },
  track: {
    height: 6,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: Radius.full,
  },

  // ── Horizontal (prototype style) ──
  hContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  hLabel: {
    ...Type.subheadline,
    fontWeight: '500',
    width: 85,
    flexShrink: 0,
  },
  hTrack: {
    flex: 1,
    height: 6,
    borderRadius: Radius.full,
    overflow: 'hidden',
    marginHorizontal: 10,
  },
  hFill: {
    height: 6,
    borderRadius: Radius.full,
  },
  hValues: {
    ...Type.caption1,
    textAlign: 'right',
    minWidth: 75,
    flexShrink: 0,
  },
  hCurrent: {
    fontWeight: '600',
  },
})

export default MacroBar
