import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { useTranslation } from 'react-i18next'
import type { LiveSummary } from './liveTrainingHelpers'

interface LiveFinishedSummaryProps {
  sessionName: string
  summary: LiveSummary
  onBackToToday: () => void
}

/**
 * Finished-session summary shown after all sets are complete (or the user
 * finishes early). Displays a 2×2 stat grid: Čas / Série / Opakování / Objem.
 * Shows a gold PR banner when prCount > 0.
 */
export function LiveFinishedSummary({
  sessionName,
  summary,
  onBackToToday,
}: LiveFinishedSummaryProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  return (
    <View
      style={[styles.card, { backgroundColor: colors.bg2, borderColor: colors.sep2 }]}
    >
      {/* Hero */}
      <View style={[styles.heroSection, { backgroundColor: colors.heroBg }]}>
        <Text style={styles.confetti}>🎉</Text>
        <Text style={[styles.heroTitle, { color: colors.onAccent }]}>
          {t('training.live.finishedTitle')}
        </Text>
        <Text style={[styles.heroSubtitle, { color: colors.onAccent + 'b3' }]}>
          {sessionName}
        </Text>
      </View>

      {/* Body */}
      <View style={[styles.body, { backgroundColor: colors.bg2 }]}>
        {/* 2×2 stat grid */}
        <View style={styles.grid}>
          <View style={[styles.statCell, { backgroundColor: colors.fill2 }]}>
            <Text style={[styles.statLabel, { color: colors.label3 }]}>
              {t('training.live.statTime')}
            </Text>
            <Text style={[styles.statValueGold, { color: colors.gold }]}>
              {summary.durationFormatted}
            </Text>
          </View>

          <View style={[styles.statCell, { backgroundColor: colors.fill2 }]}>
            <Text style={[styles.statLabel, { color: colors.label3 }]}>
              {t('training.live.statSeries')}
            </Text>
            <Text style={[styles.statValue, { color: colors.label }]}>
              {summary.setsDone}
              <Text style={[styles.statValueSub, { color: colors.label3 }]}>
                /{summary.setsPlanned}
              </Text>
            </Text>
          </View>

          <View style={[styles.statCell, { backgroundColor: colors.fill2 }]}>
            <Text style={[styles.statLabel, { color: colors.label3 }]}>
              {t('training.live.statReps')}
            </Text>
            <Text style={[styles.statValue, { color: colors.label }]}>
              {summary.totalReps}
            </Text>
          </View>

          <View style={[styles.statCell, { backgroundColor: colors.fill2 }]}>
            <Text style={[styles.statLabel, { color: colors.label3 }]}>
              {t('training.live.statExercises')}
            </Text>
            <Text style={[styles.statValue, { color: colors.label }]}>
              {summary.exerciseCount}
            </Text>
          </View>
        </View>

        {/* PR banner */}
        {summary.prCount > 0 && (
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
                {t('training.live.prBannerSubtitle', { count: summary.prCount })}
              </Text>
            </View>
          </View>
        )}

        {/* Back to today CTA */}
        <Pressable
          style={[styles.ctaBtn, { backgroundColor: colors.gold }]}
          onPress={onBackToToday}
        >
          <Text style={[styles.ctaBtnText, { color: colors.onAccent }]}>
            {t('training.live.backToToday')}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  heroSection: {
    // backgroundColor applied inline via colors.heroBg
    paddingTop: 28,
    paddingBottom: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  confetti: {
    fontSize: 48,
    lineHeight: 56,
    marginBottom: 10,
  },
  heroTitle: {
    // color applied inline via colors.onAccent
    ...Type.title2,
    letterSpacing: -0.2,
    lineHeight: 30,
  },
  heroSubtitle: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  body: {
    padding: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  statCell: {
    width: '46%',
    flexGrow: 1,
    borderRadius: Radius.sm,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.08 * 10,
    marginBottom: 4,
  },
  statValueGold: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  statValueSub: {
    fontSize: 13,
    fontWeight: '500',
  },
  prBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: 14,
    marginBottom: 12,
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
  ctaBtn: {
    borderRadius: Radius.sm,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
})

export default LiveFinishedSummary
