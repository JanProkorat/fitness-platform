import React, { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const RING_ANIM_DURATION = 400
const RING_ANIM_EASING = Easing.bezier(0.25, 0.1, 0.25, 1)

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

  // Drive strokeDashoffset through a SharedValue so the arc tweens between
  // states instead of snapping (e.g. when a meal is toggled eaten/uneaten).
  const offset = useSharedValue(circumference * (1 - ratio))
  useEffect(() => {
    offset.value = withTiming(circumference * (1 - ratio), {
      duration: RING_ANIM_DURATION,
      easing: RING_ANIM_EASING,
    })
  }, [ratio, circumference, offset])

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: offset.value,
  }))

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
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
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
