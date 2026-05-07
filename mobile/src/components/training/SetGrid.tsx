import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import type { FullPlanSet } from '@/api/training'

interface SetGridProps {
  sets: FullPlanSet[]
  /** 1-based set numbers that have been completed via live-training logging. */
  completedSetNumbers?: number[]
}

/**
 * 5-column grid: Set / Reps / Weight / Rest / Status
 * Matches the tp-ex-set-grid layout in the prototype.
 */
export function SetGrid({ sets, completedSetNumbers = [] }: SetGridProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  const { totalReps, totalVolume, hasAnyWeight } = useMemo(() => {
    let reps = 0
    let vol = 0
    let hasWeight = false
    for (const s of sets) {
      const r = s.reps ?? 0
      reps += r
      if (s.weightKg != null) {
        hasWeight = true
        vol += r * s.weightKg
      }
    }
    return { totalReps: reps, totalVolume: vol, hasAnyWeight: hasWeight }
  }, [sets])

  return (
    <View>
      {/* Header row — title-case, semi-bold, label2, left-aligned.
          Set# and Status columns are fixed-width; middle three share equal flex. */}
      <View style={[styles.grid, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.sep2 }]}>
        <Text style={[styles.hdrSet, { color: colors.label2 }]}>{t('training.set')}</Text>
        <Text style={[styles.hdr, { color: colors.label2 }]}>{t('training.reps')}</Text>
        <Text style={[styles.hdr, { color: colors.label2 }]}>{t('training.weight')}</Text>
        <Text style={[styles.hdr, { color: colors.label2 }]}>{t('training.rest')}</Text>
        <Text style={[styles.hdrStatus, { color: colors.label2 }]}>{t('training.status')}</Text>
      </View>

      {/* Data rows */}
      {sets.map((s, idx) => {
        const isLast = idx === sets.length - 1
        const cellBorder = isLast ? undefined : { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.sep2 }
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
                completedSetNumbers.includes(s.setNumber ?? -1)
                  ? { color: colors.green, fontWeight: '600' }
                  : { color: colors.label3 },
              ]}
            >
              {completedSetNumbers.includes(s.setNumber ?? -1) ? '✓' : '—'}
            </Text>
          </View>
        )
      })}

      {/* Totals row */}
      <View style={[styles.totalsRow, { borderTopColor: colors.sep2 }]}>
        <Text style={[Type.footnote, { color: colors.label2, fontWeight: '600' }]}>
          {t('training.totalsLabel')}
        </Text>
        <Text style={[Type.footnote, { color: colors.label, fontWeight: '600' }]}>
          {hasAnyWeight
            ? `${totalReps} ${t('training.reps').toLowerCase()} · ${totalVolume.toLocaleString()} kg`
            : `${totalReps} ${t('training.reps').toLowerCase()}`}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  // Set# column: narrow fixed width (mirrors tp-ex-set-grid first column: 36px)
  hdrSet: {
    width: 36,
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '600',
    // color set inline; no textTransform; left-aligned
  },
  // Status column: narrow fixed width (mirrors tp-ex-set-grid last column: 40px)
  hdrStatus: {
    width: 40,
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Middle three columns: equal flex
  hdr: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    // title-case, left-aligned — matches prototype .tp-set-hdr
  },
  cellSet: {
    width: 36,
    flexShrink: 0,
    fontSize: 12,
    // inherits color inline
  },
  cellStatus: {
    width: 40,
    flexShrink: 0,
    fontSize: 12,
    textAlign: 'center',
  },
  cell: {
    flex: 1,
    fontSize: 12,
  },
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
})

export default SetGrid
