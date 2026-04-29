/**
 * Diary request dismiss flow.
 *
 * TODO(#102): Implement the full dismiss confirmation UI (reason picker,
 * confirmation message, API call to dismiss the request).
 * This file is a placeholder so the DiaryRequestBanner's "Dismiss" CTA
 * navigates to a real route instead of a 404.
 */
import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'

export default function DiaryDismissScreen() {
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

        {/* Placeholder content — replaced by dismiss flow in #102 */}
        <View style={styles.placeholder}>
          <Text style={{ fontSize: 40, marginBottom: 20 }}>🙅</Text>
          <Text style={[Type.title3, { color: colors.label, textAlign: 'center' }]}>
            {t('today.diaryBanner.dismissScreenTitle')}
          </Text>
          <Text style={[Type.footnote, { color: colors.label2, marginTop: 8, textAlign: 'center' }]}>
            {requestId}
          </Text>
          <Text style={[Type.caption1, { color: colors.label3, marginTop: 24, textAlign: 'center' }]}>
            {/* This screen will be implemented in issue #102 */}
            {t('today.diaryBanner.dismissPlaceholder')}
          </Text>
        </View>

        {/* Go back */}
        <Pressable
          onPress={() => router.back()}
          style={[styles.goBackBtn, { backgroundColor: colors.fill }]}
        >
          <Text style={[Type.subheadline, { color: colors.label, fontWeight: '600' }]}>
            {t('common.back')}
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
  goBackBtn: {
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
})
