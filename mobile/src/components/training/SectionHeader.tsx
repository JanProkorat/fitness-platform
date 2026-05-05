/**
 * SectionHeader — accent bar + format chip + section name.
 *
 * Mirrors .tp-section-header / .tp-section-accent-bar in the prototype
 * (docs/prototypes/mobile/styles/components.css).
 *
 * Format-to-color mapping via `useTheme()` tokens only — never hardcoded hex:
 *   Standard  → colors.blue
 *   AMRAP     → colors.purple
 *   EMOM      → colors.orange
 *   ForTime   → colors.red
 *   Tabata    → colors.green  (teal in prototype; nearest theme token)
 */

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import type { WorkoutFormat } from '@/api/training'

// ─── Format → theme color ──────────────────────────────────────────────────────

/**
 * Returns the accent color token for a given section format.
 * All values come from `useTheme()` — no hex literals.
 */
export function formatAccentColor(
  format: WorkoutFormat | null | undefined,
  colors: ReturnType<typeof useTheme>,
): string {
  switch (format) {
    case 'AMRAP':
      return colors.purple
    case 'EMOM':
      return colors.orange
    case 'ForTime':
      return colors.red
    case 'Tabata':
      return colors.green
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
  const isWod = format != null && format !== 'Standard'

  return (
    <View style={[styles.container, { backgroundColor: headerBg }]}>
      {/* Accent bar — 3px left rail */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      {/* Content row */}
      <View style={styles.content}>
        {/* Format chip — only shown for non-Standard sections */}
        {isWod && (
          <View style={[styles.formatChip, { backgroundColor: accentColor + '22', borderColor: accentColor + '44' }]}>
            <Text style={[styles.formatChipText, { color: accentColor }]}>
              {t(`training.format.${format.toLowerCase()}`)}
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
