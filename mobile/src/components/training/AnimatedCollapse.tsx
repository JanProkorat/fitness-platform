import React, { useCallback, useEffect, useRef } from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import type { StyleProp, ViewStyle } from 'react-native'

export const ANIM_DURATION = 250
export const ANIM_EASING = Easing.bezier(0.25, 0.1, 0.25, 1)

interface AnimatedCollapseProps {
  expanded: boolean
  children: React.ReactNode
  /** Optional inner-style override (e.g. to add borderTopWidth or background). */
  innerStyle?: StyleProp<ViewStyle>
}

/**
 * Animated height-based collapse/expand component — the same pattern used by
 * MealCard so the training and nutrition accordions feel identical.
 *
 * The inner content is always rendered (for measurement). `overflow: hidden`
 * on the clip view clips it; the inner view is `position: absolute` so it
 * reports its intrinsic height via `onLayout` without contributing to flow.
 */
export function AnimatedCollapse({ expanded, children, innerStyle }: AnimatedCollapseProps) {
  const contentHeight = useSharedValue(0)
  const measuredHeight = useRef(0)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      contentHeight.value = expanded ? (measuredHeight.current || 0) : 0
      return
    }
    contentHeight.value = withTiming(
      expanded ? measuredHeight.current : 0,
      { duration: ANIM_DURATION, easing: ANIM_EASING },
    )
  }, [expanded])

  const animatedStyle = useAnimatedStyle(() => ({
    height: contentHeight.value,
  }))

  const handleLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    const h = e.nativeEvent.layout.height
    if (h > 0 && h !== measuredHeight.current) {
      measuredHeight.current = h
      if (expanded) {
        // First paint: snap silently. After that, animate to keep nested-measurement
        // updates smooth (e.g. when an inner AnimatedCollapse just expanded, its
        // outer measured height changes; we want to follow it).
        if (isFirstRender.current) {
          contentHeight.value = h
        } else {
          contentHeight.value = withTiming(h, {
            duration: ANIM_DURATION,
            easing: ANIM_EASING,
          })
        }
      }
    }
  }, [expanded])

  return (
    <Animated.View style={[styles.clip, animatedStyle]}>
      <View onLayout={handleLayout} style={[styles.inner, innerStyle]}>
        {children}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  inner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
})

export default AnimatedCollapse
