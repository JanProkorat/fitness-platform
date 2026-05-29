import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { interFamily } from '@/constants/typography'
import type { FullPlanSet } from '@/api/training'

interface SetGridProps {
  sets: FullPlanSet[]
  /** 1-based set numbers that have been completed via live-training logging. */
  completedSetNumbers?: number[]
  /**
   * 1-based set numbers that were skipped during live-training.
   * Rendered with the '↷' glyph (matching the in-session SetsList badge)
   * so skipped sets are visually distinct from both completed ('✓') and
   * pending ('—') sets. Parallel to completedSetNumbers — a set number
   * should not appear in both arrays.
   */
  skippedSetNumbers?: number[]
}

/**
 * 5-column grid: Set / Reps / Weight / Rest / Status
 * Matches the tp-ex-set-grid layout in the prototype.
 */
export function SetGrid({ sets, completedSetNumbers = [], skippedSetNumbers = [] }: SetGridProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  return (
    <View>
      {/* Header row — title-case, semi-bold, label2, centered.
          Set# and Status columns are fixed-width; middle three share equal flex. */}
      <View style={[styles.grid, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.sep2 }]}>
        <Text style={[styles.hdrSet, { color: colors.label2 }]}>{t('training.set')}</Text>
        <Text style={[styles.hdr, { color: colors.label2 }]}>{t('training.reps')}</Text>
        <Text style={[styles.hdr, { color: colors.label2 }]}>{t('training.weight')}</Text>
        <Text style={[styles.hdr, { color: colors.label2 }]}>{t('training.rest')}</Text>
        <Text style={[styles.hdrStatus, { color: colors.label2 }]}>{t('training.status')}</Text>
      </View>

      {/* Data rows — every row gets a bottom hairline so the table reads as
          a clean grid (matches prototype .tp-set-cell { border-bottom }). */}
      {sets.map((s) => {
        const setNum = s.setNumber ?? -1
        const isCompleted = completedSetNumbers.includes(setNum)
        const isSkipped = !isCompleted && skippedSetNumbers.includes(setNum)
        const cellBorder = { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.sep2 }
        return (
          <View key={s.setNumber} style={[styles.grid, cellBorder]}>
            <Text style={[styles.cellSet, { color: colors.label }]}>{s.setNumber}</Text>
            <Text style={[styles.cell, { color: colors.label }]}>
              {s.reps != null ? String(s.reps) : '—'}
            </Text>
            <Text style={[styles.cell, { color: colors.label }]}>
              {s.weightKg != null ? `${s.weightKg} kg` : '—'}
            </Text>
            <Text style={[styles.cell, { color: colors.label }]}>
              {s.restSeconds != null ? `${s.restSeconds} s` : '—'}
            </Text>
            <Text
              style={[
                styles.cellStatus,
                isCompleted
                  ? { color: colors.green, fontFamily: interFamily('600'), fontWeight: '600' }
                  : isSkipped
                    ? { color: colors.label3, fontFamily: interFamily('600'), fontWeight: '600' }
                    : { color: colors.label3 },
              ]}
            >
              {isCompleted ? '✓' : isSkipped ? '↷' : '—'}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  hdrSet: {
    width: 36,
    flexShrink: 0,
    fontFamily: interFamily('600'),
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  hdrStatus: {
    width: 40,
    flexShrink: 0,
    fontFamily: interFamily('600'),
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  hdr: {
    flex: 1,
    fontFamily: interFamily('600'),
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  cellSet: {
    width: 36,
    flexShrink: 0,
    fontFamily: interFamily('400'),
    fontSize: 12,
    textAlign: 'center',
  },
  cellStatus: {
    width: 40,
    flexShrink: 0,
    fontFamily: interFamily('400'),
    fontSize: 12,
    textAlign: 'center',
  },
  cell: {
    flex: 1,
    fontFamily: interFamily('400'),
    fontSize: 12,
    textAlign: 'center',
  },
})

export default SetGrid
