import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

interface BodyPartProgressBarProps {
  label: string
  color: string
  done: number
  total: number
}

/**
 * A single body-part progress bar rendered on the blue gradient hero.
 * Colors are semi-transparent whites as defined by the prototype's grad-push scene.
 */
export function BodyPartProgressBar({ label, color, done, total }: BodyPartProgressBarProps) {
  const ratio = total > 0 ? Math.min(done / total, 1) : 0

  return (
    <View style={styles.row}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%` as `${number}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.count}>
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
    color: 'rgba(255,255,255,0.88)',
    minWidth: 80,
  },
  track: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  fill: {
    height: 5,
    borderRadius: 3,
  },
  count: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    flexShrink: 0,
    minWidth: 28,
    textAlign: 'right',
  },
})

export default BodyPartProgressBar
