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

export interface ExerciseBodyPartBadge {
  /** Localized label, e.g. "Hrudník" */
  label: string
  /** Full color from the theme — used for text; a tinted background is derived from it */
  color: string
}

interface ExpandableExerciseCardProps {
  name: string
  /** Short descriptor e.g. "4 série · 8 opak · 100 kg" */
  summaryText: string
  /** Colored pills for every muscle group targeted by the exercise */
  bodyParts?: ExerciseBodyPartBadge[]
  /**
   * When provided, renders a small filled dot (8×8) at the very left of the
   * header row before the exercise name. Use the primary muscle-group color.
   * Omit to render no dot — existing call sites (plans page, live log) are
   * visually unaffected.
   */
  dotColor?: string
  isCompleted: boolean
  defaultExpanded?: boolean
  /**
   * When provided, tapping the completion indicator calls this callback.
   * The tap does NOT collapse/expand the card (propagation is stopped).
   */
  onToggle?: () => void
  /**
   * When true, the card renders as a flat row inside a parent container —
   * no margin, border, radius, or shadow; instead a hairline top divider is
   * drawn so the rows read as a connected list. Use this when the card is
   * nested inside another surface (e.g. inside an `ExpandableSessionCard`).
   * The first row in the list should pass `nested` AND `nestedFirst` to skip
   * the leading divider.
   */
  nested?: boolean
  /** When `nested`, suppresses the top divider on the first row of the list. */
  nestedFirst?: boolean
  /**
   * Hides the completion indicator (circle / checkmark) entirely. Use on
   * preview/read-only surfaces like the live-session pre-start list where a
   * disabled checkbox would be misleading.
   */
  hideCompletionIndicator?: boolean
  children: React.ReactNode
}

/**
 * Collapsible exercise card that mirrors .tp-ex-card in the prototype.
 *
 * Same pattern as `ExpandableSessionCard`: the body is always mounted (toggled
 * via `height: 0`), and Reanimated's `LinearTransition` layout animation on
 * the outer wrapper interpolates the frame change.
 */
export function ExpandableExerciseCard({
  name,
  summaryText,
  bodyParts,
  dotColor,
  isCompleted,
  defaultExpanded = false,
  onToggle,
  nested = false,
  nestedFirst = false,
  hideCompletionIndicator = false,
  children,
}: ExpandableExerciseCardProps) {
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

  const containerStyle = nested
    ? [
        styles.nestedRow,
        {
          backgroundColor: colors.bg2,
          borderTopColor: colors.sep,
          borderTopWidth: nestedFirst ? 0 : 1,
        },
      ]
    : [styles.card, { backgroundColor: colors.bg2, borderColor: colors.sep2 }]

  const headerStyle = nested ? [styles.header, styles.nestedHeader] : styles.header

  return (
    <Animated.View layout={layoutTransition} style={containerStyle}>
      <Pressable onPress={handleToggle} style={headerStyle}>
        {/* Primary-muscle-group dot — only rendered when dotColor is provided */}
        {dotColor !== undefined && (
          <View style={[styles.muscleDot, { backgroundColor: dotColor }]} />
        )}

        {/* Name + summary + body-part badges */}
        <View style={styles.nameWrap}>
          <Text style={[Type.callout, { color: colors.label, fontWeight: '600' }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[Type.caption1, { color: colors.label2, marginTop: 1 }]} numberOfLines={1}>
            {summaryText}
          </Text>
          {bodyParts && bodyParts.length > 0 && (
            <View style={styles.badgeRow}>
              {bodyParts.map(({ label, color }) => (
                <View
                  key={label}
                  style={[styles.badge, { backgroundColor: color + '22' }]}
                >
                  <Text style={[styles.badgeText, { color }]}>{label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Completion indicator — tappable when onToggle is provided.
            Hidden entirely on preview surfaces via hideCompletionIndicator. */}
        {!hideCompletionIndicator && (onToggle ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation()
              onToggle()
            }}
            hitSlop={8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isCompleted }}
            style={[
              styles.doneIndicator,
              isCompleted
                ? { backgroundColor: colors.green + '22' }
                : { borderWidth: 1, borderColor: colors.sep2 },
            ]}
          >
            {isCompleted && (
              <Ionicons name="checkmark" size={12} color={colors.green} />
            )}
          </Pressable>
        ) : (
          <View
            style={[
              styles.doneIndicator,
              isCompleted
                ? { backgroundColor: colors.green + '22' }
                : { borderWidth: 1, borderColor: colors.sep2 },
            ]}
          >
            {isCompleted && (
              <Ionicons name="checkmark" size={12} color={colors.green} />
            )}
          </View>
        ))}

        {/* Chevron */}
        <Animated.View style={[styles.chevron, chevronStyle]}>
          <Ionicons name="chevron-down" size={16} color={colors.label3} />
        </Animated.View>
      </Pressable>

      {/* Collapsible body — always mounted; clipped by height: 0 when closed. */}
      <View style={[styles.collapsibleWrap, !isOpen && styles.collapsed]}>
        <View
          style={[styles.body, { borderTopColor: colors.sep2, backgroundColor: colors.fill2 }]}
        >
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
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: Colors.dark.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  nestedRow: {
    overflow: 'hidden',
  },
  nestedHeader: {
    paddingHorizontal: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  nameWrap: {
    flex: 1,
    minWidth: 0,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  doneIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chevron: {
    flexShrink: 0,
  },
  collapsibleWrap: {
    // No `overflow: hidden` — the body is allowed to overflow while `height: 0`
    // so the outer card's LinearTransition clips it progressively. The nested
    // row / card already has `overflow: hidden`.
  },
  collapsed: {
    height: 0,
  },
  body: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  muscleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    // gap: 8 on the parent header already provides 8 px of spacing; add 2 px
    // extra so the total space between dot and name matches the prototype's 10 px.
    marginRight: 2,
    flexShrink: 0,
  },
})

export default ExpandableExerciseCard
