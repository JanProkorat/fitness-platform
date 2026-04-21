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
      {/* Header row */}
      <View style={styles.grid}>
        <Text style={[styles.hdr, { color: colors.label3 }]}>{t('training.set')}</Text>
        <Text style={[styles.hdr, { color: colors.label3 }]}>{t('training.reps')}</Text>
        <Text style={[styles.hdr, { color: colors.label3 }]}>{t('training.weight')}</Text>
        <Text style={[styles.hdr, { color: colors.label3 }]}>{t('training.rest')}</Text>
        <Text style={[styles.hdr, { color: colors.label3 }]}>{t('training.status')}</Text>
      </View>

      {/* Data rows */}
      {sets.map((s, idx) => {
        const isLast = idx === sets.length - 1
        const cellBorder = isLast ? undefined : { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.sep2 }
        return (
          <View key={s.setNumber} style={[styles.grid, cellBorder]}>
            <Text style={[styles.cell, { color: colors.label }]}>{s.setNumber}</Text>
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
                styles.cell,
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
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  hdr: {
    flex: 1,
    ...Type.caption2,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  cell: {
    flex: 1,
    ...Type.footnote,
    textAlign: 'center',
  },
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
})

export default SetGrid
