import { Text, View, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { SectionHeader } from '@/components/ui/SectionHeader'

// ─── NoDayNutritionCard ───────────────────────────────────────────────────────
// Shown when the user has an active nutrition plan but today is not covered by
// any published week. Prevents the "Waiting for plan" banner from appearing
// when the plan actually exists.

interface NoDayNutritionCardProps {
  planName?: string
}

export function NoDayNutritionCard({ planName }: NoDayNutritionCardProps) {
  const colors = useTheme()
  const { t } = useTranslation()
  return (
    <>
      <SectionHeader title={t('today.todaysNutrition')} />
      <View style={[noDayCardStyles.card, { backgroundColor: colors.bg2, borderRadius: Radius.lg }]}>
        <Text style={[noDayCardStyles.title, { color: colors.label }]}>
          {t('today.noNutritionPlanForToday')}
        </Text>
        {planName ? (
          <Text style={[noDayCardStyles.sub, { color: colors.label2 }]}>
            {planName}
          </Text>
        ) : null}
      </View>
    </>
  )
}

// ─── NoDayTrainingCard ────────────────────────────────────────────────────────
// Shown when the user has an active training plan but today has no session
// (rest day, week-cycle gap, or every published week is in the past on a
// not-yet-completed plan). Prevents the "waiting for training plan" banner
// from appearing when the plan actually exists.

interface NoDayTrainingCardProps {
  planName?: string
}

export function NoDayTrainingCard({ planName }: NoDayTrainingCardProps) {
  const colors = useTheme()
  const { t } = useTranslation()
  return (
    <>
      <SectionHeader title={t('today.todaysTraining')} />
      <View style={[noDayCardStyles.card, { backgroundColor: colors.bg2, borderRadius: Radius.lg }]}>
        <Text style={[noDayCardStyles.title, { color: colors.label }]}>
          {t('today.noTrainingForToday')}
        </Text>
        {planName ? (
          <Text style={[noDayCardStyles.sub, { color: colors.label2 }]}>
            {planName}
          </Text>
        ) : null}
      </View>
    </>
  )
}

const noDayCardStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  title: {
    ...Type.body,
    fontWeight: '600',
  },
  sub: {
    ...Type.caption1,
  },
})
