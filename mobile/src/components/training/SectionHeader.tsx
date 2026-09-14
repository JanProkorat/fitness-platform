/**
 * SectionHeader — section label + format chip + collapse chevron
 * (+ optional section-complete button).
 *
 * Mirrors .tp-section-header / .tp-section-label / .tp-section-format in the
 * prototype (docs/prototypes/mobile/styles/components.css).
 *
 * Layout order:
 *   [LABEL column: name / format chip / subtitle / note]  <flex spacer>
 *   [duration]  [section-complete button]  [chevron]
 *
 * Styling notes:
 * - No accent bar pill — removed in favour of the format chip inside labelCol.
 * - Format chip: shown for every format including Standard, positioned inside
 *   labelCol between the name and the subtitle.
 * - Section is collapsible: tapping the header (outside the complete button) toggles
 *   `isExpanded`. A chevron rotates 0°→180° when expanded. Defaults to `true`.
 * - Section-complete button: round 24×24 check indicator (outline / filled green).
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
} from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import type { WorkoutFormat, WodConfig } from '@/api/training'
import type { ColorScheme } from '@/constants/colors'
import { Type, interFamily } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { FORMAT_LABEL_KEYS, formatChipColor, formatChipBg } from '@/constants/training'
import { formatDurationCompact } from '@/lib/training-plan-format'
import { TRAINING_ANIM_DURATION, trainingEasing } from './animations'

// Chevron rotation matches the content fade + layout interpolation duration
// so the icon and the body finish their animations in lockstep.
const CHEVRON_DURATION = TRAINING_ANIM_DURATION
const chevronEasing = trainingEasing

// ─── Format → header background tint ───────────────────────────────────────────

/**
 * Returns the header background tint.
 *
 * Design choice: section bands stay clean white (transparent over the session
 * card's bg2). Format identity lives in the colored accent pill and the small
 * format chip. Exercise rows below are tinted grey instead — that visual swap
 * makes the workout label stand out as the "section title" while exercises
 * read as a contained group.
 *
 * Exported so callers (e.g. `TrainingCard`) can give note banners the same
 * background as the header they sit beneath, creating a visual extension
 * rather than a separate strip.
 */
export function sectionHeaderBg(
  _format: WorkoutFormat | null | undefined,
  _colors: ColorScheme,
): string {
  // Currently always transparent — kept as a function so future per-format
  // tinting only requires changing this one place.
  return 'transparent'
}

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface SectionHeaderProps {
  /** Display name of the section (e.g. "Hlavní", "Warm-up"). */
  name: string
  /** Workout format for this section. Null / undefined → treated as Standard. */
  format?: WorkoutFormat | null
  /**
   * Optional WOD format configuration. When set on a non-Standard format the
   * header renders a single-line subtitle under the name describing the
   * prescription (rounds × interval, work/rest, target rounds).
   */
  formatConfig?: WodConfig | null
  /**
   * Optional coach note for the whole section/workout. Rendered as a small
   * italic caption under the section name when the header is expanded.
   * Hidden when null, undefined, or whitespace-only, or when collapsed.
   */
  notes?: string | null
  /**
   * Optional estimated duration in seconds for the trailing badge.
   * Only populated for non-Standard workouts (the trainer-portal session
   * summary mirrors this same field).
   */
  durationSeconds?: number | null
  /**
   * Number of exercises in this section. Used as the inline subtitle (next
   * to the format chip) for Standard workouts which don't carry a WOD
   * prescription. Pluralized via `training.section.exerciseCount`.
   */
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
  /**
   * When true, the chevron is hidden and tapping the header is a no-op.
   * The complete-section checkbox still works. Use for empty sections
   * (e.g. ForTime "Running" with no exercises) where there is nothing to
   * expand into.
   */
  nonExpandable?: boolean
  /**
   * When true, the 1 px bottom divider on the header is suppressed.
   *
   * Use when the element immediately below the header already renders its own
   * top border so that only one hairline is visible:
   *   - Section collapsed  → the parent `sectionWrap` borderBottomWidth already
   *     provides the row-level divider; suppressing avoids a double-line.
   *   - Section expanded with a non-empty `section.notes`  → the note banner's
   *     own borderTopWidth acts as the divider.
   *
   * Default: false (bottom border shown).
   */
  suppressBottomDivider?: boolean
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Renders the section band header:
 * [labelCol: name / chip / subtitle / note] → spacer → [duration] → [complete btn] → chevron
 */
export function SectionHeader({
  name,
  format,
  formatConfig,
  durationSeconds,
  exerciseCount,
  notes,
  isSectionComplete,
  onToggleSectionComplete,
  isExpanded: isExpandedProp,
  onToggleExpanded: onToggleExpandedProp,
  defaultExpanded = true,
  nonExpandable = false,
  suppressBottomDivider = false,
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
    if (nonExpandable) return
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
  }, [isControlled, onToggleExpandedProp, chevronProgress, nonExpandable])

  // Keep the chevron in sync when driven from outside
  React.useEffect(() => {
    if (isControlled) {
      chevronProgress.value = withTiming(isExpanded ? 1 : 0, {
        duration: CHEVRON_DURATION,
        easing: chevronEasing,
      })
    }
  }, [isControlled, isExpanded, chevronProgress])

  const headerBg = sectionHeaderBg(format, colors)
  // WOD formats: any non-null, non-Standard format — used to gate the subtitle.
  const isWod = format != null && format !== 'Standard'

  // Render the indicator whenever the parent provides the completion state —
  // even without a toggle callback (e.g. plan-detail uses the indicator
  // read-only as a visual status). Tappable behavior only kicks in when
  // `onToggleSectionComplete` is also supplied.
  const showCompleteBtn = isSectionComplete !== undefined
  const isInteractiveCompleteBtn = onToggleSectionComplete !== undefined

  // Single-line prescription subtitle — only for WOD formats with a meaningful
  // config. Mirrors session-header subtitle style ("N · M · …" with ` · `).
  const subtitleParts: string[] = []
  if (isWod && format != null && formatConfig) {
    const c = formatConfig
    if (format === 'EMOM' && c.totalRounds && c.intervalSeconds) {
      subtitleParts.push(
        `${c.totalRounds} ${t('training.format.roundsShort', { count: c.totalRounds })}`,
        `${formatDurationCompact(c.intervalSeconds)} ${t('training.format.perRound')}`,
      )
    } else if (format === 'Tabata' && c.totalRounds && c.workSeconds && c.restSeconds) {
      subtitleParts.push(
        `${c.totalRounds} ${t('training.format.roundsShort', { count: c.totalRounds })}`,
        `${formatDurationCompact(c.workSeconds)} / ${formatDurationCompact(c.restSeconds)}`,
      )
    } else if (format === 'AMRAP' && c.totalRounds) {
      subtitleParts.push(
        `${t('training.format.targetRounds')}: ${c.totalRounds}`,
      )
    }
  }
  // Subtitle priority:
  //   1. WOD prescription (rounds × interval, work/rest, target rounds)
  //   2. Standard fallback — pluralized exercise count ("3 cviky")
  const subtitle = subtitleParts.length > 0
    ? subtitleParts.join(' · ')
    : (exerciseCount != null && exerciseCount > 0
        ? t('training.section.exerciseCount', { count: exerciseCount })
        : null)

  return (
    <Pressable
      onPress={handleToggle}
      style={[
        styles.container,
        {
          backgroundColor: headerBg,
          // Solid 1 px line below the workout title so it reads as clearly
          // separated from the first exercise row beneath it. Matches the
          // weight of the section divider in TrainingCard.
          // Suppressed when the immediately-following element already renders
          // its own top border (note banner, sectionWrap bottom border when
          // collapsed) — avoids stacked double-hairline artifacts.
          borderBottomWidth: suppressBottomDivider ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: colors.sep2,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ expanded: isExpanded }}
    >
      {/* Label column: name / format chip / optional subtitle / optional note.
          Format chip always shown (including Standard), positioned between
          the name and the subtitle. */}
      <View style={styles.labelCol}>
        <Text style={[styles.sectionLabel, { color: colors.label }]} numberOfLines={1}>
          {name}
        </Text>

        {/* Format chip + subtitle on the same row, with the chip first.
            The subtitle (when present) describes the WOD prescription
            ("10 kol · 1 min / kolo"); placing it inline with the chip mirrors
            the food-row pattern in MealCard where the category chip and the
            grams/kcal annotation share a line. */}
        {(format != null || subtitle) && (
          <View style={styles.chipRow}>
            {format != null && (
              <View
                style={[
                  styles.formatChip,
                  { backgroundColor: formatChipBg(format, colors) },
                ]}
              >
                <Text style={[styles.formatChipText, { color: formatChipColor(format, colors) }]}>
                  {t(`training.format.${FORMAT_LABEL_KEYS[format]}`)}
                </Text>
              </View>
            )}
            {subtitle && (
              <Text
                style={[styles.sectionSubtitle, { color: colors.label3 }]}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            )}
          </View>
        )}
        {/* Section (workout) note — small italic caption under the name.
            Only shown when expanded and note is non-empty. Lives inside the
            header's existing padding box (no extra border/background). */}
        {isExpanded && notes != null && notes.trim().length > 0 && (
          <Text style={[Type.caption1, styles.noteText, { color: colors.label2, lineHeight: 18 }]}>
            <Text style={{ fontFamily: interFamily('600'), fontWeight: '600', color: colors.gold }}>
              {t('today.sectionNoteLabel')}{' '}
            </Text>
            {notes}
          </Text>
        )}
      </View>

      {/* Flex spacer */}
      <View style={styles.spacer} />

      {/* Estimated duration — only for non-Standard workouts (Standard
          duration is undefined since it depends on per-set rest + perceived
          effort). Same compact formatter as the session summary. */}
      {durationSeconds != null && durationSeconds > 0 && (
        <Text style={[styles.exerciseCount, { color: colors.label3 }]}>
          {formatDurationCompact(durationSeconds)}
        </Text>
      )}

      {/* Section-complete round button — MealRow CheckButton pattern: 24×24,
          radius 12, borderWidth 2. Placed directly (no slot wrapper needed since
          all three levels now use the same checkbox size). marginLeft from the
          parent gap handles spacing from adjacent elements. */}
      {showCompleteBtn && (
        isInteractiveCompleteBtn ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation()
              onToggleSectionComplete!()
            }}
            hitSlop={8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSectionComplete ?? false }}
            accessibilityLabel={t('training.section.completeA11y')}
            style={[
              styles.completeBtn,
              isSectionComplete
                ? { backgroundColor: colors.green, borderColor: colors.green }
                : { borderColor: colors.sep },
            ]}
          >
            {isSectionComplete && (
              <Ionicons name="checkmark" size={14} color={colors.onAccent} />
            )}
          </Pressable>
        ) : (
          <View
            style={[
              styles.completeBtn,
              isSectionComplete
                ? { backgroundColor: colors.green, borderColor: colors.green }
                : { borderColor: colors.sep },
            ]}
          >
            {isSectionComplete && (
              <Ionicons name="checkmark" size={14} color={colors.onAccent} />
            )}
          </View>
        )
      )}

      {/* Collapse chevron — rotates 180° when expanded. When the section has
          nothing to expand into (empty ForTime), render a same-width spacer
          so the trailing checkbox column stays aligned with rows that do
          have a chevron. */}
      {nonExpandable ? (
        <View style={styles.chevronSpacer} />
      ) : (
        <Animated.View style={[styles.chevron, chevronStyle]}>
          <Ionicons name="chevron-down" size={14} color={colors.label3} />
        </Animated.View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 14,
    // Match the exercise card's nested-row paddingRight so the trailing
    // [checkbox] [chevron] column lines up across section headers and the
    // exercise rows nested under them.
    paddingRight: 12,
    gap: 8,
    minHeight: 44,
  },
  labelCol: {
    flexShrink: 1,
    minWidth: 0,
  },
  sectionLabel: {
    // Workout name — matches the food/recipe row in MealCard:
    //   Type.subheadline + fontWeight 500 (medium, not bold).
    ...Type.subheadline,
    fontWeight: '500',
  },
  sectionSubtitle: {
    // Inline with the format chip (same row). label3, small.
    fontSize: 12,
    flexShrink: 1,
    minWidth: 0,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  noteText: {
    // Section note — caption under the workout name. marginTop gives breathing
    // room from the name/subtitle; no extra padding or border (lives inside
    // the header's existing padding box).
    marginTop: 4,
  },
  formatChip: {
    // Matches MealCard's `categoryChip` — small rounded-square (not a pill),
    // no border. Lives inside `chipRow` next to the subtitle, so no marginTop
    // here (the row owns the top spacing).
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    flexShrink: 0,
  },
  formatChipText: {
    // Matches MealCard's `categoryChipText` — caption2 + 600 weight + tight
    // letter-spacing, no uppercase transform.
    ...Type.caption2,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  spacer: {
    flex: 1,
  },
  exerciseCount: {
    fontSize: 11,
    flexShrink: 0,
  },
  // Section-complete button — MealRow CheckButton pattern: 24×24, radius 12,
  // borderWidth 2. Placed directly (no slot wrapper) since all levels match.
  completeBtn: {
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
  // Empty placeholder rendered in place of the chevron on non-expandable
  // sections so the trailing column lines up with sections that have a chevron.
  // width: 16 matches the chevron icon size; marginLeft: 8 mirrors styles.trailing
  // in MealRow.
  chevronSpacer: {
    width: 16,
    marginLeft: 8,
    flexShrink: 0,
  },
})

export default SectionHeader
