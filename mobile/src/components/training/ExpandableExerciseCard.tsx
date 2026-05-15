import React, { useCallback, useState } from 'react'
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Colors } from '@/constants/colors'
import { Type, interFamily } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import {
  TRAINING_ANIM_DURATION,
  trainingEasing,
} from './animations'
import { AnimatedCollapse } from './AnimatedCollapse'

const ANIM_DURATION = TRAINING_ANIM_DURATION
const easing = trainingEasing

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
  /**
   * When true, the card has no expand/collapse affordance — chevron is hidden,
   * tapping the row doesn't toggle, and the body is never rendered. Use this
   * for WOD-format exercises (AMRAP/EMOM/Tabata/ForTime) where the prescription
   * is a single round and there's no multi-row table to show.
   */
  nonExpandable?: boolean
  /**
   * Exercise note text. When provided, renders a small italic caption line
   * directly inside the header's `nameWrap` block (after name/summary/badges),
   * visible only when the card is expanded. Same visual pattern as the
   * section-note line in `SectionHeader`.
   */
  notes?: string | null
  children: React.ReactNode
}

/**
 * Collapsible exercise card that mirrors .tp-ex-card in the prototype.
 *
 * Uses `AnimatedCollapse` for the body — the same measured-height pattern as
 * `MealCard` so the training and nutrition accordions feel identical.
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
  hideCompletionIndicator = false,
  nonExpandable = false,
  notes,
  children,
}: ExpandableExerciseCardProps) {
  const colors = useTheme()
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(defaultExpanded)
  const chevronProgress = useSharedValue(defaultExpanded ? 1 : 0)

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronProgress.value * 180}deg` }],
  }))

  const handleToggle = useCallback(() => {
    if (nonExpandable) return
    setIsOpen((prev) => {
      const next = !prev
      chevronProgress.value = withTiming(next ? 1 : 0, {
        duration: ANIM_DURATION,
        easing,
      })
      return next
    })
  }, [chevronProgress, nonExpandable])

  const containerStyle = nested
    ? [
        styles.nestedRow,
        {
          // Nested exercise rows inside a session card use the neutral fill
          // (`fill3`) so the section header above reads as a clean white band
          // and the exercises read as a grouped grey strip beneath it.
          backgroundColor: colors.fill3,
        },
      ]
    : [styles.card, { backgroundColor: colors.bg2, borderColor: colors.sep2 }]

  const headerStyle = nested ? [styles.header, styles.nestedHeader] : styles.header

  return (
    <View style={containerStyle}>
      <Pressable onPress={handleToggle} style={headerStyle}>
        {/* Primary-muscle-group dot — only rendered when dotColor is provided */}
        {dotColor !== undefined && (
          <View style={[styles.muscleDot, { backgroundColor: dotColor }]} />
        )}

        {/* Name + (optional) summary + body-part badges. When summaryText is
            empty (e.g. exercise without prescribed reps/weight), the name
            sits centered in the row, lined up with the colored bullet. */}
        <View style={styles.nameWrap}>
          <Text style={[Type.subheadline, { color: colors.label }]} numberOfLines={1}>
            {name}
          </Text>
          {summaryText.length > 0 && (
            <Text style={[Type.caption1, { color: colors.label2, marginTop: 1 }]} numberOfLines={1}>
              {summaryText}
            </Text>
          )}
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
          {/* Exercise note — visible only when expanded and note is non-empty.
              Lives inside nameWrap so it shares the header's existing padding
              box with no extra border or background, mirroring the section-note
              pattern in SectionHeader. */}
          {isOpen && notes != null && notes.trim().length > 0 && (
            <Text style={[Type.caption1, { color: colors.label2, marginTop: 4, lineHeight: 18 }]}>
              <Text style={{ fontFamily: interFamily('600'), fontWeight: '600', color: colors.gold }}>
                {t('today.exerciseNoteLabel')}{' '}
              </Text>
              {notes}
            </Text>
          )}
        </View>

        {/* Completion indicator — tappable when onToggle is provided.
            Hidden entirely on preview surfaces via hideCompletionIndicator.
            MealRow CheckButton pattern: 24×24, radius 12, borderWidth 2.
            Placed directly (no slot wrapper) since all three levels now match. */}
        {!hideCompletionIndicator && (
          onToggle ? (
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
                  ? { backgroundColor: colors.green, borderColor: colors.green }
                  : { borderColor: colors.sep },
              ]}
            >
              {isCompleted && (
                <Ionicons name="checkmark" size={14} color={colors.onAccent} />
              )}
            </Pressable>
          ) : (
            <View
              style={[
                styles.doneIndicator,
                isCompleted
                  ? { backgroundColor: colors.green, borderColor: colors.green }
                  : { borderColor: colors.sep },
              ]}
            >
              {isCompleted && (
                <Ionicons name="checkmark" size={14} color={colors.onAccent} />
              )}
            </View>
          )
        )}

        {/* Chevron — hidden when there's nothing to expand into. A spacer of
            equal width replaces it so the trailing checkbox column lines up
            across rows that do/don't have a chevron. */}
        {nonExpandable ? (
          <View style={styles.chevronSpacer} />
        ) : (
          <Animated.View style={[styles.chevron, chevronStyle]}>
            <Ionicons name="chevron-down" size={16} color={colors.label3} />
          </Animated.View>
        )}
      </Pressable>

      {/* Collapsible body — AnimatedCollapse renders content always (for
          measurement) and animates height. Skipped entirely for non-expandable
          rows (WOD prescription is in the header summary, no detail table). */}
      {!nonExpandable && (
        <AnimatedCollapse
          expanded={isOpen}
          innerStyle={[styles.body, { borderTopColor: colors.sep2, backgroundColor: colors.fill2 }]}
        >
          {children}
        </AnimatedCollapse>
      )}
    </View>
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
    // Match section header's 14 px left inset so the dot has breathing room
    // from the card edge (Fix #4). Right side keeps the standard 12 px.
    paddingLeft: 14,
    paddingRight: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
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
    fontFamily: interFamily('600'),
    fontSize: 11,
    fontWeight: '600',
  },
  // Completion indicator — MealRow CheckButton pattern: 24×24, radius 12,
  // borderWidth 2. Placed directly (no slot wrapper) since all three levels match.
  doneIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chevron: {
    flexShrink: 0,
    marginLeft: 8,
  },
  // Empty placeholder in place of the chevron on non-expandable rows.
  // width: 16 matches the icon size; marginLeft: 8 mirrors MealRow's styles.trailing.
  chevronSpacer: {
    width: 16,
    marginLeft: 8,
    flexShrink: 0,
  },
  body: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  muscleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    // gap: 8 on the parent header already provides 8 px of spacing; add 2 px
    // extra so the total space between dot and name matches the prototype's 10 px.
    marginRight: 2,
    flexShrink: 0,
  },
})

export default ExpandableExerciseCard
