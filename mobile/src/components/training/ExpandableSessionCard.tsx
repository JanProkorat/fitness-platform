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
import { Colors, type ColorScheme } from '@/constants/colors'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'

const ANIM_DURATION = 260
const easing = Easing.out(Easing.cubic)
const layoutTransition = LinearTransition.duration(ANIM_DURATION).easing(
  Easing.out(Easing.cubic),
)

/**
 * Maps a session's start hour to the prototype kind-color.
 *
 * Prototype mapping (components.css, kind-* palette):
 *   05–10  morning   → orange  #ff9500
 *   11–13  noon      → green   #34c759
 *   14–16  afternoon → blue    #007aff
 *   17–20  evening   → purple  #af52de
 *   else   late      → red     #ff3b30
 *
 * All colors are sourced from the theme (no inline hex).
 */
function sessionKindColor(startHour: number | null | undefined, colors: ColorScheme): string {
  if (startHour == null) return colors.orange  // fallback: morning
  if (startHour >= 5 && startHour <= 10) return colors.orange
  if (startHour >= 11 && startHour <= 13) return colors.green
  if (startHour >= 14 && startHour <= 16) return colors.blue
  if (startHour >= 17 && startHour <= 20) return colors.purple
  return colors.red
}

interface ExpandableSessionCardProps {
  order: number
  name: string
  /** Short descriptor e.g. "4 cviky · 45 min" */
  summaryText: string
  completedCount: number
  totalCount: number
  /**
   * Hour component (0–23) of the session's scheduled start time.
   * Used to pick a time-of-day accent color for the left bar and expanded
   * header tint. Null / undefined → falls back to morning orange.
   */
  startHour?: number | null
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
 * - A 4 px left bar colored by time-of-day (`startHour`) mirrors the
 *   `.tp-session.kind-*` border-left rule.
 * - When expanded, the header band is tinted with the same hue at 10% alpha
 *   (`kindColor + '1a'`), matching `.tp-session.kind-*.expanded .tp-session-header`.
 * - The body is always mounted so the inner exercise cards preserve their own
 *   expand/collapse state. When `isOpen` toggles, the body's `height` flips
 *   between `0` and `auto`; Reanimated's `LinearTransition` layout animation on
 *   the outer wrapper then interpolates the frame change smoothly.
 */
export function ExpandableSessionCard({
  order,
  name,
  summaryText,
  completedCount,
  totalCount,
  startHour,
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

  // Left-bar accent color — derived from session start hour, matches prototype kind palette.
  const kindColor = sessionKindColor(startHour, colors)
  // Header tint when expanded: same hue at 10% alpha. '1a' = 26/255 ≈ 10.2%.
  const headerBg = isOpen ? kindColor + '1a' : 'transparent'

  return (
    <Animated.View
      layout={layoutTransition}
      style={[
        styles.card,
        {
          backgroundColor: colors.bg2,
          borderColor: colors.sep2,
          borderLeftColor: kindColor,
        },
      ]}
    >
      <Pressable onPress={handleToggle} style={[styles.header, { backgroundColor: headerBg }]}>
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
    // 4 px left bar — color is set inline from kindColor.
    borderLeftWidth: 4,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: Colors.dark.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
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
    borderTopWidth: StyleSheet.hairlineWidth,
    // No horizontal padding — exercise rows are flush with the section edges
    // per prototype (.tp-session-exercises .tp-ex-card { margin:0 }).
    paddingTop: 0,
    paddingBottom: 0,
    gap: 0,
  },
})

export default ExpandableSessionCard
