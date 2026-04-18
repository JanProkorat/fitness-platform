import React, { useCallback, useState } from 'react'
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'

const ANIM_DURATION = 260
const easing = Easing.out(Easing.cubic)

interface ExpandableSessionCardProps {
  order: number
  name: string
  /** Short descriptor e.g. "4 cviky · 45 min" */
  summaryText: string
  completedCount: number
  totalCount: number
  defaultExpanded?: boolean
  children: React.ReactNode
}

/**
 * Collapsible session card that mirrors .tp-session in the prototype.
 * The order chip (28×28, radius 10) uses the fill background.
 */
export function ExpandableSessionCard({
  order,
  name,
  summaryText,
  completedCount,
  totalCount,
  defaultExpanded = false,
  children,
}: ExpandableSessionCardProps) {
  const colors = useTheme()
  const [contentHeight, setContentHeight] = useState<number | null>(null)
  // Tracks whether we're at a fully settled open state. While animating (or
  // closed), we drive height explicitly from the shared value; once open, we
  // release to natural `height: auto` so nested expand/collapse inside this
  // card reflows correctly without leaving empty space.
  const [isOpen, setIsOpen] = useState(defaultExpanded)

  const progress = useSharedValue(defaultExpanded ? 1 : 0)

  const contentStyle = useAnimatedStyle(() => {
    if (isOpen) return { opacity: 1 }
    return {
      height: contentHeight != null ? progress.value * contentHeight : undefined,
      opacity: progress.value,
    }
  })
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }))

  const handleContentLayout = useCallback(
    (e: LayoutChangeEvent) => {
      if (contentHeight == null) setContentHeight(e.nativeEvent.layout.height)
    },
    [contentHeight],
  )

  const handleToggle = useCallback(() => {
    const next = progress.value < 1 ? 1 : 0
    setIsOpen(false)
    progress.value = withTiming(next, { duration: ANIM_DURATION, easing }, (finished) => {
      if (finished && next === 1) runOnJS(setIsOpen)(true)
    })
  }, [progress])

  const allDone = totalCount > 0 && completedCount === totalCount
  const pillColor = allDone ? colors.green : colors.label2
  const pillBg = allDone ? colors.green + '1E' : colors.fill

  return (
    <View style={[styles.card, { backgroundColor: colors.bg2, borderColor: colors.sep2 }]}>
      <Pressable onPress={handleToggle} style={styles.header}>
        {/* Order chip */}
        <View style={[styles.orderChip, { backgroundColor: colors.fill }]}>
          <Text style={[Type.footnote, { color: colors.label, fontWeight: '700' }]}>
            {order}
          </Text>
        </View>

        {/* Name + summary */}
        <View style={styles.nameWrap}>
          <Text style={[Type.callout, { color: colors.label, fontWeight: '600' }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[Type.caption1, { color: colors.label2, marginTop: 1 }]} numberOfLines={1}>
            {summaryText}
          </Text>
        </View>

        {/* Done/total pill */}
        <View style={[styles.progressPill, { backgroundColor: pillBg }]}>
          <Text style={[Type.caption1, { color: pillColor, fontWeight: '600' }]}>
            {completedCount}/{totalCount}
          </Text>
        </View>

        {/* Chevron */}
        <Animated.View style={[styles.chevron, chevronStyle]}>
          <Ionicons name="chevron-down" size={16} color={colors.label3} />
        </Animated.View>
      </Pressable>

      {/* Collapsible body — height driven by shared value once measured */}
      <Animated.View style={[styles.collapsibleWrap, contentStyle]}>
        <View
          onLayout={handleContentLayout}
          style={[styles.body, { borderTopColor: colors.sep2 }]}
        >
          {children}
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  orderChip: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  nameWrap: {
    flex: 1,
    minWidth: 0,
  },
  progressPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
    flexShrink: 0,
  },
  chevron: {
    flexShrink: 0,
  },
  collapsibleWrap: {
    overflow: 'hidden',
  },
  body: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 0,
  },
})

export default ExpandableSessionCard
