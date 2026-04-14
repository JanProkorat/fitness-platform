import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { goldAlpha } from '@/constants/colors'
import { Radius } from '@/constants/radius'
import { GoldButton } from '@/components/ui/GoldButton'

const FEATURES = [
  { icon: '🏋️', bgColor: 'rgba(0,122,255,0.12)', titleKey: 'today.featureTraining', descKey: 'today.featureTrainingDesc' },
  { icon: '🥗', bgColor: 'rgba(52,199,89,0.12)', titleKey: 'today.featureNutrition', descKey: 'today.featureNutritionDesc' },
  { icon: '📈', bgColor: 'rgba(255,149,0,0.12)', titleKey: 'today.featureProgress', descKey: 'today.featureProgressDesc' },
] as const

export function NoTrainerState() {
  const colors = useTheme()
  const router = useRouter()
  const { t } = useTranslation()

  return (
    <View style={styles.container}>
      {/* Gold notice banner */}
      <View style={[styles.notice, { backgroundColor: colors.goldBg, borderColor: goldAlpha['25'] }]}>
        <View style={[styles.noticeIcon, { backgroundColor: goldAlpha['15'] }]}>
          <Text style={styles.noticeEmoji}>🏋️</Text>
        </View>
        <View style={styles.noticeBody}>
          <Text style={[Type.headline, { color: colors.label }]}>
            {t('today.getStarted')}
          </Text>
          <Text style={[Type.footnote, { color: colors.label2, marginTop: 2, lineHeight: 18 }]}>
            {t('today.getStartedDesc')}
          </Text>
        </View>
      </View>

      {/* CTA */}
      <GoldButton
        title={t('today.findTrainer')}
        onPress={() => router.push('/(client)/discover')}
        style={styles.cta}
      />

      {/* Feature preview list */}
      <Text style={[Type.footnote, styles.sectionLabel, { color: colors.label3 }]}>
        {t('today.whatYouGet')}
      </Text>
      <View style={[styles.list, { backgroundColor: colors.bg2 }]}>
        {FEATURES.map((f, i) => (
          <View
            key={f.titleKey}
            style={[
              styles.row,
              i < FEATURES.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.sep2 },
            ]}
          >
            <View style={[styles.rowIcon, { backgroundColor: f.bgColor }]}>
              <Text style={styles.rowEmoji}>{f.icon}</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={[Type.headline, { color: colors.label }]}>{t(f.titleKey)}</Text>
              <Text style={[Type.caption1, { color: colors.label2, marginTop: 1 }]}>{t(f.descKey)}</Text>
            </View>
            <Text style={[styles.chevron, { color: colors.label3 }]}>›</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

export default NoTrainerState

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
  },
  // Notice banner
  notice: {
    marginHorizontal: 16,
    padding: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noticeIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeEmoji: {
    fontSize: 20,
  },
  noticeBody: {
    flex: 1,
  },
  // CTA
  cta: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 24,
  },
  // Feature list
  sectionLabel: {
    marginHorizontal: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  list: {
    marginHorizontal: 16,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowEmoji: {
    fontSize: 18,
  },
  rowBody: {
    flex: 1,
  },
  chevron: {
    fontSize: 20,
    fontWeight: '300',
  },
})
