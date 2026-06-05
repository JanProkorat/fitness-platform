import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { interFamily } from '@/constants/typography'
import type { FullPlanSet } from '@/api/training'
import type { LoggedSetDto } from '@/api/wod-types'

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
  /**
   * Per-set actual vs. planned data from the backend (#440).
   * When provided, SetGrid renders treatment B:
   *   - actual value as the headline (gold when the set has been completed)
   *   - snapshot-planned value as a quiet "plán…" caption below
   *   - gold change-indicator dot next to the status column when isModified
   *
   * Indexed by 1-based set number matching `sets[i].setNumber`.
   * Sets without a matching entry in this map fall back to the planned-only display.
   *
   * For the Today card the per-exercise sets don't carry individual actual data
   * (that lives in loggedSetsBySessionExercise) — callers should convert to this
   * map before passing in.
   */
  loggedSets?: LoggedSetDto[]
}

/**
 * 5-column grid: Set / Reps / Weight / Rest / Status
 * Matches the tp-ex-set-grid layout in the prototype.
 *
 * Treatment B (when loggedSets is provided):
 *   - Actual value is the headline per cell (displayed in gold when completed).
 *   - Snapshot-planned value is a quiet "plán…" caption below the headline.
 *   - A small gold change-indicator dot appears in the status column when the
 *     set's isModified flag is true.
 *   - Extra sets beyond the plan count (setNumber > sets.length) show the actual
 *     in gold with a "navíc" caption and no planned value.
 *   - Skipped sets show the planned caption and the skip marker; actual is blank.
 */
export function SetGrid({
  sets,
  completedSetNumbers = [],
  skippedSetNumbers = [],
  loggedSets,
}: SetGridProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  // Build a lookup map: 1-based setNumber → LoggedSetDto
  const loggedBySetNumber = React.useMemo<Map<number, LoggedSetDto>>(() => {
    const map = new Map<number, LoggedSetDto>()
    if (loggedSets) {
      for (const ls of loggedSets) {
        if (ls.setNumber != null) {
          map.set(ls.setNumber, ls)
        }
      }
    }
    return map
  }, [loggedSets])

  // Determine the full set of row numbers to render.
  // When loggedSets has entries beyond the planned count (extra sets), include them.
  const plannedSetNumbers = sets.map((s) => s.setNumber ?? -1).filter((n) => n > 0)
  const extraSetNumbers: number[] = []
  if (loggedSets) {
    for (const ls of loggedSets) {
      const sn = ls.setNumber
      if (sn != null && !plannedSetNumbers.includes(sn) && sn > 0) {
        extraSetNumbers.push(sn)
      }
    }
    extraSetNumbers.sort((a, b) => a - b)
  }

  return (
    <View>
      {/* Header row */}
      <View style={[styles.grid, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.sep2 }]}>
        <Text style={[styles.hdrSet, { color: colors.label2 }]}>{t('training.set')}</Text>
        <Text style={[styles.hdr, { color: colors.label2 }]}>{t('training.reps')}</Text>
        <Text style={[styles.hdr, { color: colors.label2 }]}>{t('training.weight')}</Text>
        <Text style={[styles.hdr, { color: colors.label2 }]}>{t('training.rest')}</Text>
        <Text style={[styles.hdrStatus, { color: colors.label2 }]}>{t('training.status')}</Text>
      </View>

      {/* Planned set rows */}
      {sets.map((s) => {
        const setNum = s.setNumber ?? -1
        const isCompleted = completedSetNumbers.includes(setNum)
        const isSkipped = !isCompleted && skippedSetNumbers.includes(setNum)
        const logged = loggedBySetNumber.get(setNum)
        const cellBorder = { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.sep2 }

        // Treatment B: when we have logged data for this set
        if (logged && loggedSets) {
          const { isModified } = logged
          const hasActualReps = logged.actualReps != null
          const hasActualWeight = logged.actualWeightKg != null
          const isExtra = false // planned row — not extra

          // Value cells — show actual + planned caption, or planned only when skipped
          const repsCell = isSkipped
            ? { headline: null, caption: logged.plannedReps != null ? `${logged.plannedReps}` : (s.reps != null ? `${s.reps}` : null) }
            : hasActualReps
              ? { headline: `${logged.actualReps}`, caption: logged.plannedReps != null ? `${logged.plannedReps}` : null }
              : { headline: s.reps != null ? `${s.reps}` : null, caption: null }

          const weightCell = isSkipped
            ? { headline: null, caption: formatWeight(logged.plannedWeightKg ?? s.weightKg) }
            : logged.actualWeightKg != null
              ? { headline: formatWeight(logged.actualWeightKg), caption: logged.plannedWeightKg != null ? formatWeight(logged.plannedWeightKg) : null }
              : { headline: formatWeight(s.weightKg), caption: null }

          const actualColor = isCompleted ? colors.gold : colors.label

          return (
            <View key={setNum} style={[styles.grid, cellBorder]}>
              <Text style={[styles.cellSet, { color: colors.label }]}>{s.setNumber}</Text>

              {/* Reps cell — actual headline + planned caption */}
              <View style={[styles.cellStack, styles.cellFlex]}>
                {repsCell.headline != null ? (
                  <Text style={[styles.cell, { color: actualColor }]}>{repsCell.headline}</Text>
                ) : (
                  <Text style={[styles.cell, { color: colors.label3 }]}>—</Text>
                )}
                {repsCell.caption != null && (
                  <Text style={[styles.planCaption, { color: colors.label3 }]}>
                    {t('training.plan')}{repsCell.caption}
                  </Text>
                )}
              </View>

              {/* Weight cell */}
              <View style={[styles.cellStack, styles.cellFlex]}>
                {weightCell.headline != null ? (
                  <Text style={[styles.cell, { color: actualColor }]}>{weightCell.headline}</Text>
                ) : (
                  <Text style={[styles.cell, { color: colors.label3 }]}>—</Text>
                )}
                {weightCell.caption != null && (
                  <Text style={[styles.planCaption, { color: colors.label3 }]}>
                    {t('training.plan')}{weightCell.caption}
                  </Text>
                )}
              </View>

              {/* Rest cell — always from plan */}
              <Text style={[styles.cell, styles.cellFlex, { color: colors.label }]}>
                {s.restSeconds != null ? `${s.restSeconds} s` : '—'}
              </Text>

              {/* Status cell — tick, skip, dash + gold dot when isModified */}
              <View style={[styles.cellStatus, styles.statusWrap]}>
                <Text
                  style={[
                    styles.statusText,
                    isCompleted
                      ? { color: colors.green, fontFamily: interFamily('600'), fontWeight: '600' }
                      : isSkipped
                        ? { color: colors.label3, fontFamily: interFamily('600'), fontWeight: '600' }
                        : { color: colors.label3 },
                  ]}
                >
                  {isCompleted ? '✓' : isSkipped ? '↷' : '—'}
                </Text>
                {isModified && !isSkipped && (
                  <View style={[styles.modifiedDot, { backgroundColor: colors.gold }]} />
                )}
              </View>
            </View>
          )
        }

        // Plain display (no logged data / pre-log)
        return (
          <View key={setNum} style={[styles.grid, cellBorder]}>
            <Text style={[styles.cellSet, { color: colors.label }]}>{s.setNumber}</Text>
            <Text style={[styles.cell, styles.cellFlex, { color: colors.label }]}>
              {s.reps != null ? String(s.reps) : '—'}
            </Text>
            <Text style={[styles.cell, styles.cellFlex, { color: colors.label }]}>
              {s.weightKg != null ? `${s.weightKg} kg` : '—'}
            </Text>
            <Text style={[styles.cell, styles.cellFlex, { color: colors.label }]}>
              {s.restSeconds != null ? `${s.restSeconds} s` : '—'}
            </Text>
            <Text
              style={[
                styles.cellStatus,
                styles.statusText,
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

      {/* Extra set rows (beyond plan count) — actual in gold, "navíc" caption */}
      {extraSetNumbers.map((setNum) => {
        const logged = loggedBySetNumber.get(setNum)
        if (!logged) return null
        const cellBorder = { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.sep2 }

        return (
          <View key={`extra-${setNum}`} style={[styles.grid, cellBorder]}>
            <Text style={[styles.cellSet, { color: colors.gold }]}>{setNum}</Text>

            <View style={[styles.cellStack, styles.cellFlex]}>
              {logged.actualReps != null ? (
                <Text style={[styles.cell, { color: colors.gold }]}>{logged.actualReps}</Text>
              ) : (
                <Text style={[styles.cell, { color: colors.label3 }]}>—</Text>
              )}
              <Text style={[styles.planCaption, { color: colors.gold }]}>
                {t('training.navic')}
              </Text>
            </View>

            <View style={[styles.cellStack, styles.cellFlex]}>
              {logged.actualWeightKg != null ? (
                <Text style={[styles.cell, { color: colors.gold }]}>{formatWeight(logged.actualWeightKg)}</Text>
              ) : (
                <Text style={[styles.cell, { color: colors.label3 }]}>—</Text>
              )}
            </View>

            {/* Rest — not applicable for extra sets */}
            <Text style={[styles.cell, styles.cellFlex, { color: colors.label3 }]}>—</Text>

            <View style={[styles.cellStatus, styles.statusWrap]}>
              <Text style={[styles.statusText, { color: colors.gold, fontFamily: interFamily('600'), fontWeight: '600' }]}>
                ✓
              </Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

/** Format a weight value as "X kg" or "BW" when null / zero. */
function formatWeight(kg: number | null | undefined): string | null {
  if (kg == null) return null
  if (kg === 0) return 'BW'
  return `${kg} kg`
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  },
  cell: {
    fontFamily: interFamily('400'),
    fontSize: 12,
    textAlign: 'center',
  },
  cellFlex: {
    flex: 1,
  },
  /** Stack for cells that show an actual headline + planned caption below. */
  cellStack: {
    alignItems: 'center',
  },
  /** Quiet "plán X" caption below the actual value. */
  planCaption: {
    fontFamily: interFamily('400'),
    fontSize: 10,
    textAlign: 'center',
    marginTop: 1,
  },
  /** Status column inner wrapper — horizontally centres the tick/skip
   *  glyph and optionally the gold modification dot. */
  statusWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontFamily: interFamily('400'),
    fontSize: 12,
    textAlign: 'center',
  },
  /** Small gold dot rendered below the status glyph when isModified. */
  modifiedDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 2,
  },
})

export default SetGrid
