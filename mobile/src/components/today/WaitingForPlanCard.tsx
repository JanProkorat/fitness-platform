import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Radius } from '@/constants/radius'

interface WaitingForPlanCardProps {
  /** Client is waiting for a training plan to be created */
  waitingForTraining: boolean
  /** Client is waiting for a nutrition plan to be created */
  waitingForNutrition: boolean
}

export function WaitingForPlanCard({
  waitingForTraining,
  waitingForNutrition,
}: WaitingForPlanCardProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  if (!waitingForTraining && !waitingForNutrition) return null

  return (
    <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
      <Text style={styles.emoji}>⏳</Text>
      <Text style={[styles.title, { color: colors.label }]}>
        {waitingForTraining && waitingForNutrition
          ? t('today.waitingBothTitle')
          : waitingForTraining
            ? t('today.waitingTrainingTitle')
            : t('today.waitingNutritionTitle')}
      </Text>
      <Text style={[styles.desc, { color: colors.label2 }]}>
        {waitingForTraining && waitingForNutrition
          ? t('today.waitingBothDesc')
          : waitingForTraining
            ? t('today.waitingTrainingDesc')
            : t('today.waitingNutritionDesc')}
      </Text>
      <View style={[styles.chip, { backgroundColor: colors.goldBg }]}>
        <Text style={styles.chipEmoji}>⏳</Text>
        <Text style={[styles.chipLabel, { color: colors.gold }]}>
          {waitingForTraining && waitingForNutrition
            ? t('today.waitingChipBoth')
            : waitingForTraining
              ? t('today.waitingChipTraining')
              : t('today.waitingChipNutrition')}
        </Text>
      </View>
    </View>
  )
}

export default WaitingForPlanCard

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderRadius: Radius.lg,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 44,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  desc: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 280,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 100,
  },
  chipEmoji: {
    fontSize: 12,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
})
