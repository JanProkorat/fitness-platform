/**
 * SectionHeader — accent bar + format chip + section name.
 *
 * Mirrors .tp-section-header / .tp-section-accent-bar in the prototype
 * (docs/prototypes/mobile/styles/components.css).
 *
 * Format-to-color mapping via `useTheme()` tokens only — never hardcoded hex:
 *   Standard  → label3 text / fill2 bg (neutral)
 *   AMRAP     → orange text / orange + '14' bg
 *   EMOM      → purple text / purple + '14' bg
 *   ForTime   → blue   text / blue   + '14' bg
 *   Tabata    → red    text / red    + '14' bg
 *
 * The accent bar on the left still uses the saturated accent color for
 * visual contrast regardless of the chip's softer treatment.
 */

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import type { WorkoutFormat } from '@/api/training'
import type { ColorScheme } from '@/constants/colors'
import { FORMAT_LABEL_KEYS, formatChipColor, formatChipBg } from '@/constants/training'

// ─── Format → accent bar color ─────────────────────────────────────────────────

/**
 * Returns the saturated accent color used on the 3 px left rail.
 * Kept separate from the chip palette so the bar remains high-contrast.
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
      return colors.blue
  }
}

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface SectionHeaderProps {
  /** Display name of the section (e.g. "Hlavní", "Warm-up"). */
  name: string
  /** Workout format for this section. Null / undefined → treated as Standard. */
  format?: WorkoutFormat | null
  /** Optional exercise count for subtitle. */
  exerciseCount?: number
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Renders the section band header: a 3px accent bar on the left, the format
 * chip (hidden for Standard), and the section name + optional exercise count.
 */
export function SectionHeader({ name, format, exerciseCount }: SectionHeaderProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  const accentColor = formatAccentColor(format, colors)
  const headerBg = accentColor + '0f' // ~6% opacity tint, matches prototype
  // WOD formats: any non-null, non-Standard format.
  // Re-checked inline in JSX for TypeScript narrowing.
  const isWod = format != null && format !== 'Standard'

  return (
    <View style={[styles.container, { backgroundColor: headerBg }]}>
      {/* Accent bar — 3px left rail */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      {/* Content row */}
      <View style={styles.content}>
        {/* Format chip — only shown for non-Standard sections.
            `isWod` already narrows format to a non-null, non-Standard WOD
            type; the extra `format != null` below satisfies the TS narrowing
            flow without re-asserting the Standard exclusion. */}
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

        {/* Section name */}
        <Text style={[styles.sectionName, { color: colors.label }]} numberOfLines={1}>
          {name}
        </Text>

        {/* Exercise count */}
        {exerciseCount != null && exerciseCount > 0 && (
          <Text style={[styles.exerciseCount, { color: colors.label3 }]}>
            {t('training.section.exerciseCount', { count: exerciseCount })}
          </Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 40,
  },
  accentBar: {
    width: 3,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  formatChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1,
    flexShrink: 0,
  },
  formatChipText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionName: {
    ...Type.subheadline,
    fontWeight: '600',
    flex: 1,
    minWidth: 0,
  },
  exerciseCount: {
    ...Type.caption2,
    flexShrink: 0,
  },
})

export default SectionHeader
