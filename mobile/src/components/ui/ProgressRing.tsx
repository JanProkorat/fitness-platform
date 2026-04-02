import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'

interface ProgressRingProps {
  current: number
  total: number
  size?: number
  strokeWidth?: number
  color?: string
  showLabel?: boolean
}

export function ProgressRing({
  current,
  total,
  size = 56,
  strokeWidth = 5,
  color,
  showLabel = true,
}: ProgressRingProps) {
  const colors = useTheme()
  const ringColor = color ?? colors.gold
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const ratio = total > 0 ? Math.min(current / total, 1) : 0
  const offset = circumference * (1 - ratio)

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.fill}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {showLabel && (
        <View style={styles.labelContainer}>
          <Text style={[styles.label, { color: colors.label }]}>
            {current}/{total}
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...Type.caption2,
    fontWeight: '600',
  },
})

export default ProgressRing
