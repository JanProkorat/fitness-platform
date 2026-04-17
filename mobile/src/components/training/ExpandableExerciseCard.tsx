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
  isCompleted: boolean
  defaultExpanded?: boolean
  children: React.ReactNode
}

/**
 * Collapsible exercise card that mirrors .tp-ex-card in the prototype.
 * The colored dot indicates the primary muscle group.
 */
export function ExpandableExerciseCard({
  name,
  summaryText,
  bodyParts,
  isCompleted,
  defaultExpanded = false,
  children,
}: ExpandableExerciseCardProps) {
  const colors = useTheme()
  const [contentHeight, setContentHeight] = useState<number | null>(null)
  // Release to `height: auto` when fully open so inner content size changes
  // don't leave stale empty space on the parent.
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

  return (
    <View style={[styles.card, { backgroundColor: colors.bg2, borderColor: colors.sep2 }]}>
      <Pressable onPress={handleToggle} style={styles.header}>
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

        {/* Completion indicator */}
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

        {/* Chevron */}
        <Animated.View style={[styles.chevron, chevronStyle]}>
          <Ionicons name="chevron-down" size={16} color={colors.label3} />
        </Animated.View>
      </Pressable>

      {/* Collapsible body — height driven by shared value once measured */}
      <Animated.View style={[styles.collapsibleWrap, contentStyle]}>
        <View
          onLayout={handleContentLayout}
          style={[styles.body, { borderTopColor: colors.sep2, backgroundColor: colors.fill2 }]}
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
    marginBottom: 8,
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
    overflow: 'hidden',
  },
  body: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
})

export default ExpandableExerciseCard
