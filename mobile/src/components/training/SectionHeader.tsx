/**
 * SectionHeader — accent bar + section label + format chip + collapse chevron
 * (+ optional section-complete button).
 *
 * Mirrors .tp-section-header / .tp-section-accent-bar / .tp-section-label /
 * .tp-section-format in the prototype (docs/prototypes/mobile/styles/components.css).
 *
 * Layout order matches the prototype:
 *   [3px × 18px accent pill]  [LABEL uppercase 11/700]  [FORMAT chip]  <flex spacer>
 *   [count]  [section-complete button]  [chevron]
 *
 * Styling notes:
 * - Header background is tinted per format (mirrors prototype CSS lines 178–189):
 *     Standard  → fill3 (neutral ~6% alpha)
 *     AMRAP     → orange + '0f' (~6% alpha)
 *     EMOM      → orange + '0f'  (wait — EMOM is orange in prototype, but chip is purple)
 *   Actually the prototype maps:
 *     strength/Standard → blue tint  → but we use fill3 for Standard (neutral)
 *     conditioning      → green tint
 *     amrap             → purple tint
 *     emom              → orange tint
 *     fortime           → red tint
 *     tabata            → teal/green tint
 *   We mirror this using `formatChipBg` which already encodes the format→tint map.
 * - Accent bar pill: saturated hue at full opacity (3 × 18 px rounded).
 * - Format chip: hidden for Standard.
 * - Section is collapsible: tapping the header (outside the complete button) toggles
 *   `isExpanded`. A chevron rotates 0°→180° when expanded. Defaults to `true`.
 * - Section-complete button: round 20 × 20 check indicator (outline / filled green).
 *   Taps call `onToggleSectionComplete()`. Does NOT propagate to the collapse toggle.
 *
 * All colors via `useTheme()` tokens — no inline hex.
 */

import React, { useCallback, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import type { WorkoutFormat } from '@/api/training'
import type { ColorScheme } from '@/constants/colors'
import { FORMAT_LABEL_KEYS, formatChipColor, formatChipBg } from '@/constants/training'

const CHEVRON_DURATION = 220
const chevronEasing = Easing.out(Easing.cubic)

// ─── Format → accent bar color ─────────────────────────────────────────────────

/**
 * Returns the saturated accent color for the 3 px × 18 px bar pill.
 * Source-of-truth is `formatChipColor` — the bar uses the same hue.
 */
export function formatAccentColor(
  format: WorkoutFormat | null | undefined,
  colors: ColorScheme,
): string {
  switch (format) {
    case 'AMRAP':
      return colors.orange
    case 'EMOM':
      return colors.purple
    case 'ForTime':
      return colors.blue
    case 'Tabata':
      return colors.red
    case 'Standard':
    default:
      return colors.label3
  }
}

// ─── Format → header background tint ───────────────────────────────────────────

/**
 * Returns the header background tint per format.
 * Mirrors prototype CSS lines 178–189 (.tp-section.format-* .tp-section-header).
 * Uses the same soft alpha as `formatChipBg` (6–8%) so the two tokens stay in sync.
 * Standard falls back to `colors.fill3` (neutral ~6% alpha).
 */
function formatHeaderBg(
  format: WorkoutFormat | null | undefined,
  colors: ColorScheme,
): string {
  if (format == null || format === 'Standard') return colors.fill3
  // formatChipBg already encodes the format→tint map with '14' (8%) alpha.
  // Re-use it directly — any 6–8% alpha is within spec.
  return formatChipBg(format, colors)
}

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface SectionHeaderProps {
  /** Display name of the section (e.g. "Hlavní", "Warm-up"). */
  name: string
  /** Workout format for this section. Null / undefined → treated as Standard. */
  format?: WorkoutFormat | null
  /** Optional exercise count for the trailing badge. */
  exerciseCount?: number
  /**
   * Whether every exercise in this section is already completed.
   * Controls the filled vs. outline state of the section-complete button.
   * Omit to hide the button entirely.
   */
  isSectionComplete?: boolean
  /**
   * Called when the user taps the section-complete round button.
   * When omitted, the button is not rendered.
   */
  onToggleSectionComplete?: () => void
  /**
   * Controlled expand/collapse state. When provided together with
   * `onToggleExpanded`, the component is fully controlled.
   * When both are omitted, the component manages its own state (default true).
   */
  isExpanded?: boolean
  /** Called when the header is tapped (excluding the complete button). */
  onToggleExpanded?: () => void
  /**
   * Initial expansion state used only in uncontrolled mode.
   * Ignored when `isExpanded` is provided.
   * Defaults to `true`.
   */
  defaultExpanded?: boolean
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Renders the section band header in the correct prototype order:
 * accent pill → LABEL → format chip → spacer → count → [complete btn] → chevron
 */
export function SectionHeader({
  name,
  format,
  exerciseCount,
  isSectionComplete,
  onToggleSectionComplete,
  isExpanded: isExpandedProp,
  onToggleExpanded: onToggleExpandedProp,
  defaultExpanded = true,
}: SectionHeaderProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  // ── Controlled vs uncontrolled expand/collapse ───────────────────────────────
  const [localExpanded, setLocalExpanded] = useState(defaultExpanded)
  const isControlled = isExpandedProp !== undefined
  const isExpanded = isControlled ? isExpandedProp : localExpanded

  const chevronProgress = useSharedValue(isExpanded ? 1 : 0)

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronProgress.value * 180}deg` }],
  }))

  const handleToggle = useCallback(() => {
    if (isControlled) {
      onToggleExpandedProp?.()
    } else {
      setLocalExpanded((prev) => {
        const next = !prev
        chevronProgress.value = withTiming(next ? 1 : 0, {
          duration: CHEVRON_DURATION,
          easing: chevronEasing,
        })
        return next
      })
    }
  }, [isControlled, onToggleExpandedProp, chevronProgress])

  // Keep the chevron in sync when driven from outside
  React.useEffect(() => {
    if (isControlled) {
      chevronProgress.value = withTiming(isExpanded ? 1 : 0, {
        duration: CHEVRON_DURATION,
        easing: chevronEasing,
      })
    }
  }, [isControlled, isExpanded, chevronProgress])

  const accentColor = formatAccentColor(format, colors)
  const headerBg = formatHeaderBg(format, colors)
  // WOD formats: any non-null, non-Standard format.
  const isWod = format != null && format !== 'Standard'

  const showCompleteBtn = onToggleSectionComplete !== undefined

  return (
    <Pressable
      onPress={handleToggle}
      style={[styles.container, { backgroundColor: headerBg }]}
      accessibilityRole="button"
      accessibilityState={{ expanded: isExpanded }}
    >
      {/* 3 × 18 px accent pill */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      {/* Section label — uppercase, 11/700, label2 */}
      <Text style={[styles.sectionLabel, { color: colors.label2 }]} numberOfLines={1}>
        {name}
      </Text>

      {/* Format chip — only shown for non-Standard sections */}
      {isWod && format != null && (
        <View
          style={[
            styles.formatChip,
            {
              backgroundColor: formatChipBg(format, colors),
              borderColor: formatChipColor(format, colors) + '33',
            },
          ]}
        >
          <Text style={[styles.formatChipText, { color: formatChipColor(format, colors) }]}>
            {t(`training.format.${FORMAT_LABEL_KEYS[format]}`)}
          </Text>
        </View>
      )}

      {/* Flex spacer */}
      <View style={styles.spacer} />

      {/* Exercise count badge — trailing, small, label3 */}
      {exerciseCount != null && exerciseCount > 0 && (
        <Text style={[styles.exerciseCount, { color: colors.label3 }]}>
          {t('training.section.exerciseCount', { count: exerciseCount })}
        </Text>
      )}

      {/* Section-complete round button — same visual family as per-exercise check */}
      {showCompleteBtn && (
        <Pressable
          onPress={(e) => {
            e.stopPropagation()
            onToggleSectionComplete()
          }}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isSectionComplete ?? false }}
          accessibilityLabel={t('training.section.completeA11y')}
          style={[
            styles.completeBtn,
            isSectionComplete
              ? { backgroundColor: colors.green + '22' }
              : { borderWidth: 1, borderColor: colors.sep2 },
          ]}
        >
          {isSectionComplete && (
            <Ionicons name="checkmark" size={12} color={colors.green} />
          )}
        </Pressable>
      )}

      {/* Collapse chevron — rotates 180° when expanded */}
      <Animated.View style={[styles.chevron, chevronStyle]}>
        <Ionicons name="chevron-down" size={14} color={colors.label3} />
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingLeft: 14,
    paddingRight: 10,
    gap: 8,
    minHeight: 34,
  },
  accentBar: {
    // 3 × 18 rounded pill matching .tp-section-accent-bar
    width: 3,
    height: 18,
    borderRadius: 2,
    flexShrink: 0,
  },
  sectionLabel: {
    // 11 px, 700 weight, uppercase, tight letter-spacing — mirrors .tp-section-label
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    flexShrink: 1,
    minWidth: 0,
  },
  formatChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 99,
    borderWidth: 1,
    flexShrink: 0,
  },
  formatChipText: {
    // ~9.5 px → use 10 px (RN doesn't render fractionals reliably)
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  spacer: {
    flex: 1,
  },
  exerciseCount: {
    fontSize: 11,
    flexShrink: 0,
  },
  completeBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chevron: {
    flexShrink: 0,
    width: 16,
    alignItems: 'center',
  },
})

export default SectionHeader
