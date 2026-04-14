import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Radius } from '@/constants/radius'
import { GoldButton } from '@/components/ui/GoldButton'
import { useTranslation } from 'react-i18next'

// ─── Success Screen (matches prototype) ──────────────────────────────

export function SuccessScreen({ onContinue }: { onContinue: () => void }) {
  const colors = useTheme()
  const { t } = useTranslation()

  return (
    <View style={styles.successContainer}>
      <View style={[styles.successRing, { borderColor: colors.green + '33' }]}>
        <Ionicons name="checkmark" size={48} color={colors.green} />
      </View>
      <Text style={[styles.successTitle, { color: colors.label }]}>
        {t('questionnaire.allDone')}
      </Text>
      <Text style={[styles.successDesc, { color: colors.label2 }]}>
        {t('questionnaire.submittedDesc')}
      </Text>
      <GoldButton title={t('questionnaire.goHome')} onPress={onContinue} style={{ width: '100%', marginTop: 32 }} />
    </View>
  )
}

export default SuccessScreen

const styles = StyleSheet.create({
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  successRing: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(52,199,89,0.12)', borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  successTitle: { fontSize: 28, fontWeight: '700', letterSpacing: -0.4 },
  successDesc: { fontSize: 16, lineHeight: 25, textAlign: 'center', marginTop: 12 },
})
