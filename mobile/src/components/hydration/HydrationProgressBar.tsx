/**
 * HydrationProgressBar — compact horizontal progress bar for the Today-screen
 * HydrationCard. Shows current ml vs. target with a gold fill.
 *
 * Uses `useTheme()` tokens exclusively — no hardcoded colors.
 */

import React from 'react'
import { View, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'

interface HydrationProgressBarProps {
  currentMl: number
  targetMl: number
  /** Bar height in points. Default 6. */
  barHeight?: number
}

export function HydrationProgressBar({
  currentMl,
  targetMl,
  barHeight = 6,
}: HydrationProgressBarProps): React.ReactElement {
  const colors = useTheme()
  const ratio = targetMl > 0 ? Math.min(currentMl / targetMl, 1) : 0

  return (
    <View
      style={[
        styles.track,
        { height: barHeight, backgroundColor: colors.fill, borderRadius: barHeight / 2 },
      ]}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${ratio * 100}%`,
            backgroundColor: colors.gold,
            borderRadius: barHeight / 2,
          },
        ]}
      />
    </View>
  )
}

export default HydrationProgressBar

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
})
