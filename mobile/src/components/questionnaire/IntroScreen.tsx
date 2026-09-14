import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Colors, goldAlpha } from '@/constants/colors'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { GoldButton } from '@/components/ui/GoldButton'
import { Avatar } from '@/components/ui/Avatar'
import { useTranslation } from 'react-i18next'
import { QuestionnaireData } from './questionnaire-types'

// ─── Intro Screen (matches prototype) ────────────────────────────────

export function IntroScreen({
  questionnaire,
  onStart,
  onClose,
}: {
  questionnaire: QuestionnaireData
  onStart: () => void
  onClose: () => void
}) {
  const colors = useTheme()
  const { t } = useTranslation()

  const profName = questionnaire.professionalName
  const profFirstName = profName.split(' ')[0]
  const profRole = questionnaire.professionalRole ?? ''
  const profCity = questionnaire.professionalCity ?? ''

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.introScroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.introHero}>
          <Text style={{ fontSize: 72, lineHeight: 80 }}>📋</Text>
          <Text style={[styles.introTitle, { color: colors.label }]}>
            {questionnaire.title}
          </Text>
          <Text style={[styles.introDesc, { color: colors.label2 }]}>
            {t('questionnaire.introDesc', { name: profFirstName })}
          </Text>

          {/* Trainer card */}
          <View style={[styles.trainerCard, { backgroundColor: colors.bg2 }]}>
            <Avatar name={profName} size="sm" />
            <View style={{ flex: 1 }}>
              <Text style={[Type.headline, { color: colors.label, fontSize: 15 }]}>
                {profName}
              </Text>
              <Text style={[Type.caption1, { color: colors.label2, marginTop: 2 }]}>
                {profRole}{profCity ? ` · ${profCity}` : ''}
              </Text>
            </View>
          </View>

          {/* Meta chips */}
          <View style={styles.metaChips}>
            <View style={[styles.metaChip, { backgroundColor: colors.fill }]}>
              <Text style={[styles.metaChipText, { color: colors.label2 }]}>
                📝 {questionnaire.questionCount} {t('questionnaire.questions')}
              </Text>
            </View>
            <View style={[styles.metaChip, { backgroundColor: colors.fill }]}>
              <Text style={[styles.metaChipText, { color: colors.label2 }]}>
                🔒 {t('questionnaire.privateOnly')}
              </Text>
            </View>
          </View>
        </View>

        {/* Trainer message with questionnaire description */}
        <View style={styles.introBottom}>
          <View style={[styles.trainerMessage, { backgroundColor: colors.goldBg, borderColor: goldAlpha['20'] }]}>
            <Text style={{ color: colors.label2, lineHeight: 22, fontSize: 13 }}>
              <Text style={{ fontWeight: '600', color: colors.label }}>{t('questionnaire.messageFrom', { name: profFirstName })}:</Text>
              {' „'}{questionnaire.description || t('questionnaire.trainerIntro')}{'"'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomCta, { borderTopColor: colors.sep2, backgroundColor: colors.bg + 'F2' }]}>
        <GoldButton title={t('questionnaire.start')} onPress={onStart} />
      </View>

      {/* Close button */}
      <Pressable onPress={onClose} hitSlop={8} style={styles.closeAbsolute}>
        <Ionicons name="close" size={22} color={colors.label3} />
      </Pressable>
    </View>
  )
}

export default IntroScreen

const styles = StyleSheet.create({
  flex: { flex: 1 },
  introScroll: { paddingBottom: 120 },
  introHero: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  introTitle: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5, marginTop: 20, textAlign: 'center' },
  introDesc: { fontSize: 16, lineHeight: 25, marginTop: 12, textAlign: 'center' },
  trainerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 28, padding: 14, paddingHorizontal: 16,
    borderRadius: Radius.lg, width: '100%',
    shadowColor: Colors.dark.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  metaChips: { flexDirection: 'row', gap: 8, marginTop: 24, flexWrap: 'wrap', justifyContent: 'center' },
  metaChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full },
  metaChipText: { fontSize: 13, fontWeight: '500' },
  introBottom: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32, gap: 12 },
  trainerMessage: { padding: 14, borderRadius: Radius.sm, borderWidth: 1, borderColor: 'transparent' },
  closeAbsolute: { position: 'absolute', top: 16, right: 16, padding: 4 },
  bottomCta: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 36, borderTopWidth: 1 },
})
