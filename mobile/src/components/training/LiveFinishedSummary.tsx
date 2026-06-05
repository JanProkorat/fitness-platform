import React from 'react'
import { ScrollView, View, Text, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { useTranslation } from 'react-i18next'
import type { WorkoutFormat, LoggedSetDto } from '@/api/wod-types'
import type { FullPlanSet } from '@/api/training'
import { SetGrid } from '@/components/training/SetGrid'

/**
 * Per-exercise set data for the finished-summary view.
 * Carries the planned sets alongside the 1-based set numbers that were
 * completed or skipped so SetGrid can render '✓' / '↷' / '—' per cell.
 */
export interface FinishedExerciseSetData {
  exerciseName: string
  sets: FullPlanSet[]
  /** 1-based set numbers that the user actually completed. */
  completedSetNumbers: number[]
  /** 1-based set numbers that the user skipped (↷). */
  skippedSetNumbers: number[]
  /**
   * Actual vs. snapshot-planned set data from the finished workout log.
   * When present, SetGrid renders treatment B: actual headline, planned
   * caption, and a gold change-indicator dot for modified sets (#441).
   */
  loggedSets?: LoggedSetDto[]
}

export interface FinishedWorkoutCardData {
  name: string
  format: WorkoutFormat | null
  durationFormatted: string | null
  metaText: string | null
  /**
   * Per-exercise set detail for Standard-format workouts.
   * When present, each exercise's sets are rendered in a SetGrid below the
   * workout card header so skipped sets show '↷' rather than blending into
   * the completed '✓' column.
   * WOD-format workouts leave this null (they don't have per-set grids).
   */
  exerciseSets: FinishedExerciseSetData[] | null
}

interface LiveFinishedSummaryProps {
  sessionName: string
  durationFormatted: string
  workouts: FinishedWorkoutCardData[]
  prCount: number
}

/**
 * Session summary shown when the entire training session is finished.
 *
 * Layout:
 *   - Hero card (dark blue): 🎉 + "Trénink dokončen!" + session name + total time.
 *   - Optional PR banner.
 *   - Internally-scrollable list of per-workout cards.
 *
 * The page-level "Zpět na dnešek" CTA lives outside this component
 * (pinned to the screen bottom by `training-session/[id].tsx`).
 */
export function LiveFinishedSummary({
  sessionName,
  durationFormatted,
  workouts,
  prCount,
}: LiveFinishedSummaryProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  return (
    <View style={styles.root}>
      {/* Hero card — its own bordered card. Carries session time directly
          under the session name (replaces the old 2×2 stats grid). */}
      <View
        style={[
          styles.heroCard,
          { backgroundColor: colors.heroBg, borderColor: colors.sep2 },
        ]}
      >
        <Text style={styles.confetti}>🎉</Text>
        <Text style={[styles.heroTitle, { color: colors.onAccent }]}>
          {t('training.live.finishedTitle')}
        </Text>
        <Text style={[styles.heroSubtitle, { color: colors.onAccent + 'b3' }]}>
          {sessionName}
        </Text>
        <Text style={[styles.heroDuration, { color: colors.gold }]}>
          {durationFormatted}
        </Text>
      </View>

      {/* PR banner */}
      {prCount > 0 && (
        <View
          style={[
            styles.prBanner,
            { backgroundColor: colors.goldBg, borderColor: colors.gold + '4d' },
          ]}
        >
          <Text style={styles.prTrophy}>🏆</Text>
          <View style={styles.prText}>
            <Text style={[styles.prTitle, { color: colors.gold }]}>
              {t('training.live.prBannerTitle')}
            </Text>
            <Text style={[styles.prSubtitle, { color: colors.label2 }]}>
              {t('training.live.prBannerSubtitle', { count: prCount })}
            </Text>
          </View>
        </View>
      )}

      {/* Workouts list — flex:1 so it claims the remaining viewport
          between the hero / PR banner and the pinned CTA. ScrollView
          handles overflow when the session has many workouts. */}
      <ScrollView
        style={styles.workoutsScroll}
        contentContainerStyle={styles.workoutsContent}
        showsVerticalScrollIndicator={false}
      >
        {workouts.map((w, i) => (
          <View
            key={`${w.name}-${i}`}
            style={[
              styles.workoutCard,
              { backgroundColor: colors.bg2, borderColor: colors.sep2 },
            ]}
          >
            <View style={styles.workoutHeaderRow}>
              <Text
                style={[styles.workoutName, { color: colors.label }]}
                numberOfLines={1}
              >
                {w.name}
              </Text>
              {w.format != null && w.format !== 'Standard' && (
                <View style={[styles.formatChip, { backgroundColor: colors.goldBg }]}>
                  <Text style={[styles.formatChipText, { color: colors.gold }]}>
                    {w.format.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            {(w.durationFormatted != null || w.metaText != null) && (
              <View style={styles.workoutMetaRow}>
                {w.durationFormatted != null && (
                  <Text style={[styles.workoutMetaItem, { color: colors.label2 }]}>
                    {w.durationFormatted}
                  </Text>
                )}
                {w.durationFormatted != null && w.metaText != null && (
                  <Text style={[styles.workoutMetaDot, { color: colors.label3 }]}>
                    ·
                  </Text>
                )}
                {w.metaText != null && (
                  <Text style={[styles.workoutMetaItem, { color: colors.label2 }]}>
                    {w.metaText}
                  </Text>
                )}
              </View>
            )}
            {/* Per-exercise set grids — only for Standard-format workouts
                that carry exerciseSets data. Each exercise gets its own
                SetGrid so the user can see '✓' / '↷' / '—' per set.
                The exercise name appears as a small eyebrow above the grid. */}
            {w.exerciseSets != null && w.exerciseSets.length > 0 && (
              <View style={[styles.exerciseSetsWrap, { borderTopColor: colors.sep2 }]}>
                {w.exerciseSets.map((ex, exIdx) => (
                  <View
                    key={`${ex.exerciseName}-${exIdx}`}
                    style={[
                      styles.exerciseBlock,
                      exIdx < w.exerciseSets!.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.sep2,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.exerciseName, { color: colors.label2 }]}
                      numberOfLines={1}
                    >
                      {ex.exerciseName}
                    </Text>
                    <SetGrid
                      sets={ex.sets}
                      completedSetNumbers={ex.completedSetNumbers}
                      skippedSetNumbers={ex.skippedSetNumbers}
                      loggedSets={ex.loggedSets}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  heroCard: {
    width: '100%',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: 'center',
  },
  confetti: {
    fontSize: 44,
    lineHeight: 52,
    marginBottom: 8,
  },
  heroTitle: {
    ...Type.title2,
    letterSpacing: -0.2,
  },
  heroSubtitle: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  heroDuration: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    marginTop: 8,
  },
  prBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: 14,
  },
  prTrophy: {
    fontSize: 28,
  },
  prText: {
    flex: 1,
  },
  prTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  prSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  workoutsScroll: {
    flex: 1,
  },
  workoutsContent: {
    paddingBottom: 4,
    gap: 8,
  },
  workoutCard: {
    width: '100%',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  workoutHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  workoutName: {
    ...Type.headline,
    flex: 1,
    minWidth: 0,
  },
  formatChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  formatChipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.04 * 11,
  },
  workoutMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  workoutMetaItem: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  workoutMetaDot: {
    fontSize: 13,
    marginHorizontal: 6,
  },
  /** Wrapper for the per-exercise set grids — separated from the card header
   *  by a hairline divider. Top padding gives breathing room below the meta
   *  row / chip row. */
  exerciseSetsWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
    paddingTop: 4,
  },
  exerciseBlock: {
    paddingVertical: 4,
  },
  /** Exercise-name eyebrow above the SetGrid — small, dim, matches the
   *  section-label style used in the pre-start and plan-detail views. */
  exerciseName: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.08 * 11,
    paddingHorizontal: 8,
    paddingBottom: 2,
  },
})

export default LiveFinishedSummary
