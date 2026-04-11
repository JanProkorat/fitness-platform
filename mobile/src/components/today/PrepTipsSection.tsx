import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Radius } from '@/constants/radius'
import { SectionHeader } from '@/components/ui/SectionHeader'

interface PrepTipsSectionProps {
  hasTraining: boolean
  hasNutrition: boolean
}

interface Tip {
  icon: string
  bg: string
  titleKey: string
  textKey: string
}

function getTips(hasT: boolean, hasN: boolean): Tip[] {
  if (hasT && !hasN) {
    return [
      { icon: '💧', bg: 'rgba(0,122,255,0.10)', titleKey: 'today.tipHydrationTitle', textKey: 'today.tipHydrationTraining' },
      { icon: '😴', bg: 'rgba(255,149,0,0.10)', titleKey: 'today.tipSleepTitle', textKey: 'today.tipSleepText' },
      { icon: '🥩', bg: 'rgba(52,199,89,0.10)', titleKey: 'today.tipProteinTitle', textKey: 'today.tipProteinTraining' },
      { icon: '🎒', bg: 'rgba(175,82,222,0.10)', titleKey: 'today.tipGearTitle', textKey: 'today.tipGearText' },
    ]
  }
  if (!hasT && hasN) {
    return [
      { icon: '💧', bg: 'rgba(0,122,255,0.10)', titleKey: 'today.tipHydrationTitle', textKey: 'today.tipHydrationNutrition' },
      { icon: '🛒', bg: 'rgba(255,149,0,0.10)', titleKey: 'today.tipShoppingTitle', textKey: 'today.tipShoppingText' },
      { icon: '⌚', bg: 'rgba(52,199,89,0.10)', titleKey: 'today.tipRegularityTitle', textKey: 'today.tipRegularityText' },
      { icon: '🥩', bg: 'rgba(175,82,222,0.10)', titleKey: 'today.tipProteinTitle', textKey: 'today.tipProteinNutrition' },
    ]
  }
  // Both
  return [
    { icon: '💧', bg: 'rgba(0,122,255,0.10)', titleKey: 'today.tipHydrationTitle', textKey: 'today.tipHydrationBoth' },
    { icon: '😴', bg: 'rgba(255,149,0,0.10)', titleKey: 'today.tipSleepTitle', textKey: 'today.tipSleepText' },
    { icon: '🥩', bg: 'rgba(52,199,89,0.10)', titleKey: 'today.tipProteinTitle', textKey: 'today.tipProteinBoth' },
    { icon: '🎒', bg: 'rgba(175,82,222,0.10)', titleKey: 'today.tipPrepTitle', textKey: 'today.tipPrepText' },
  ]
}

export function PrepTipsSection({ hasTraining, hasNutrition }: PrepTipsSectionProps) {
  const colors = useTheme()
  const { t } = useTranslation()
  const tips = getTips(hasTraining, hasNutrition)

  return (
    <View>
      <SectionHeader title={t('today.prepTitle')} />
      <View style={styles.list}>
        {tips.map((tip) => (
          <View key={tip.titleKey} style={[styles.tipCard, { backgroundColor: colors.bg2 }]}>
            <View style={[styles.tipIcon, { backgroundColor: tip.bg }]}>
              <Text style={styles.tipEmoji}>{tip.icon}</Text>
            </View>
            <View style={styles.tipBody}>
              <Text style={[styles.tipTitle, { color: colors.label }]}>
                {t(tip.titleKey)}
              </Text>
              <Text style={[styles.tipText, { color: colors.label2 }]}>
                {t(tip.textKey)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

export default PrepTipsSection

const styles = StyleSheet.create({
  list: {
    marginHorizontal: 16,
    gap: 10,
  },
  tipCard: {
    borderRadius: Radius.sm,
    padding: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  tipIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tipEmoji: {
    fontSize: 18,
  },
  tipBody: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 18,
  },
})
