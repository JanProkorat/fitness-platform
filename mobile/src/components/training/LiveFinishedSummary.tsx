import React from 'react'
import { ScrollView, View, Text, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { useTranslation } from 'react-i18next'
import type { WorkoutFormat } from '@/api/wod-types'

export interface FinishedWorkoutCardData {
  name: string
  format: WorkoutFormat | null
  durationFormatted: string | null
  metaText: string | null
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
})

export default LiveFinishedSummary
