/**
 * Diary request accept flow — detail screen.
 *
 * TODO(#99): Implement the full accept wizard (step-by-step onboarding,
 * schedule picker, confirmation). This file is a placeholder so the
 * DiaryRequestBanner's "Accept" CTA navigates to a real route.
 */
import React from 'react'
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { href } from '@/lib/navigation'

export default function DiaryRequestScreen() {
  const colors = useTheme()
  const { t } = useTranslation()
  const router = useRouter()
  const { requestId } = useLocalSearchParams<{ requestId: string }>()

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Header */}
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.fill }]}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Text style={[Type.body, { color: colors.label }]}>‹</Text>
        </Pressable>

        {/* Placeholder content — replaced by accept wizard in #99 */}
        <View style={styles.placeholder}>
          <ActivityIndicator size="large" color={colors.green} style={styles.spinner} />
          <Text style={[Type.title3, { color: colors.label, textAlign: 'center' }]}>
            {t('today.diaryBanner.screenTitle')}
          </Text>
          <Text style={[Type.footnote, { color: colors.label2, marginTop: 8, textAlign: 'center' }]}>
            {requestId}
          </Text>
          <Text style={[Type.caption1, { color: colors.label3, marginTop: 24, textAlign: 'center' }]}>
            {/* This screen will be implemented in issue #99 */}
            Accept wizard coming soon
          </Text>
        </View>

        {/* Dismiss link */}
        <Pressable
          onPress={() => router.push(href(`/(client)/diary/${requestId}/dismiss`))}
          style={({ pressed }) => [styles.dismissLink, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[Type.footnote, { color: colors.label2 }]}>
            {t('today.diaryBanner.dismiss')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.md,
    marginBottom: 32,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginBottom: 24,
  },
  dismissLink: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
})
