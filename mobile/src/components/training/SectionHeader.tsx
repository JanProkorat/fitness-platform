/**
 * SectionHeader — accent bar + section label + format chip (+ optional trailing controls).
 *
 * Mirrors .tp-section-header / .tp-section-accent-bar / .tp-section-label /
 * .tp-section-format in the prototype (docs/prototypes/mobile/styles/components.css).
 *
 * Layout order matches the prototype:
 *   [3px × 18px accent pill]  [LABEL uppercase 11/700]  [FORMAT chip]  <flex spacer>  [trailing]
 *
 * Styling notes vs. the previous version:
 * - Container uses `alignItems:'center'` so the accent bar stays 18 px tall
 *   (not `alignItems:'stretch'` which made it span the full row height).
 * - Accent bar is a fixed 3 × 18 rounded pill — NOT a full-height left rail.
 * - Header background is a constant neutral tint (fill3 ≈ rgba(120,120,128,.06))
 *   regardless of format — format identity is conveyed by the chip, not the band.
 * - Format chip is hidden for Standard sections (same as before).
 *
 * Format-to-color mapping via `useTheme()` tokens only — never hardcoded hex:
 *   Standard  → chip hidden
 *   AMRAP     → orange text / orange + '14' bg
 *   EMOM      → purple text / purple + '14' bg
 *   ForTime   → blue   text / blue   + '14' bg
 *   Tabata    → red    text / red    + '14' bg
 */

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import type { WorkoutFormat } from '@/api/training'
import type { ColorScheme } from '@/constants/colors'
import { FORMAT_LABEL_KEYS, formatChipColor, formatChipBg } from '@/constants/training'

// ─── Format → accent bar color ─────────────────────────────────────────────────

/**
 * Returns the saturated accent color used on the 3 px × 18 px bar pill.
 * Kept separate from the chip palette so the bar stays high-contrast and
 * readable at its small size.
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
 * Renders the section band header in the correct prototype order:
 * accent pill → LABEL → format chip → spacer → (optional trailing).
 */
export function SectionHeader({ name, format, exerciseCount }: SectionHeaderProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  const accentColor = formatAccentColor(format, colors)
  // WOD formats: any non-null, non-Standard format.
  const isWod = format != null && format !== 'Standard'

  return (
    <View style={[styles.container, { backgroundColor: colors.fill3 }]}>
      {/* 3 × 18 px accent pill — fixed size, centered vertically.
          Container uses alignItems:'center' so this stays 18 px tall. */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      {/* Section label — uppercase, 11/700, label2 */}
      <Text style={[styles.sectionLabel, { color: colors.label2 }]} numberOfLines={1}>
        {name}
      </Text>

      {/* Format chip — only shown for non-Standard sections.
          Sits immediately right of the label per prototype row order. */}
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

      {/* Flex spacer — pushes any trailing element to the far right */}
      <View style={styles.spacer} />

      {/* Optional exercise count — trailing, small, label3 */}
      {exerciseCount != null && exerciseCount > 0 && (
        <Text style={[styles.exerciseCount, { color: colors.label3 }]}>
          {t('training.section.exerciseCount', { count: exerciseCount })}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    // Center items so the accent bar stays at its declared 18 px height.
    alignItems: 'center',
    paddingVertical: 7,
    paddingLeft: 14,
    paddingRight: 12,
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
})

export default SectionHeader
