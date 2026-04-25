import React, { useCallback, useState } from 'react'
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  LinearTransition,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { useTheme } from '@/hooks/useTheme'
import { Colors } from '@/constants/colors'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'

const ANIM_DURATION = 260
const easing = Easing.out(Easing.cubic)
const layoutTransition = LinearTransition.duration(ANIM_DURATION).easing(
  Easing.out(Easing.cubic),
)

interface ExpandableSessionCardProps {
  order: number
  name: string
  /** Short descriptor e.g. "4 cviky · 45 min" */
  summaryText: string
  completedCount: number
  totalCount: number
  defaultExpanded?: boolean
  /**
   * Optional node injected at the right side of the header row, between the
   * progress pill and the chevron. Use this to render a session-level checkbox.
   * Tapping the injected element should call `event.stopPropagation()` so it
   * does NOT collapse/expand the card.
   */
  headerRight?: React.ReactNode
  children: React.ReactNode
}

/**
 * Collapsible session card that mirrors .tp-session in the prototype.
 *
 * The body is always mounted so the inner exercise cards preserve their own
 * expand/collapse state. When `isOpen` toggles, the body's `height` flips
 * between `0` and `auto`; Reanimated's `LinearTransition` layout animation on
 * the outer wrapper then interpolates the frame change smoothly.
 */
export function ExpandableSessionCard({
  order,
  name,
  summaryText,
  completedCount,
  totalCount,
  defaultExpanded = false,
  headerRight,
  children,
}: ExpandableSessionCardProps) {
  const colors = useTheme()
  const [isOpen, setIsOpen] = useState(defaultExpanded)
  const chevronProgress = useSharedValue(defaultExpanded ? 1 : 0)

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronProgress.value * 180}deg` }],
  }))

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev
      chevronProgress.value = withTiming(next ? 1 : 0, {
        duration: ANIM_DURATION,
        easing,
      })
      return next
    })
  }, [chevronProgress])

  const allDone = totalCount > 0 && completedCount === totalCount
  const pillColor = allDone ? colors.green : colors.label2
  const pillBg = allDone ? colors.green + '1E' : colors.fill

  return (
    <Animated.View
      layout={layoutTransition}
      style={[styles.card, { backgroundColor: colors.bg2, borderColor: colors.sep2 }]}
    >
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

        {/* Optional header-right slot (e.g. session-level checkbox) */}
        {headerRight}

        {/* Chevron */}
        <Animated.View style={[styles.chevron, chevronStyle]}>
          <Ionicons name="chevron-down" size={16} color={colors.label3} />
        </Animated.View>
      </Pressable>

      {/* Collapsible body — always mounted so nested exercise state persists.
          `height: 0 + overflow: hidden` clips it; the outer LinearTransition
          animates the card's frame change smoothly. */}
      <View style={[styles.collapsibleWrap, !isOpen && styles.collapsed]}>
        <View style={[styles.body, { borderTopColor: colors.sep }]}>
          {children}
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: Colors.dark.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
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
    // No `overflow: hidden` — we *want* the body to overflow when `height: 0`
    // so that the outer card's LinearTransition clips the children progressively
    // as the card's frame animates shut. The card itself has `overflow: hidden`.
  },
  collapsed: {
    height: 0,
  },
  body: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 0,
  },
})

export default ExpandableSessionCard
