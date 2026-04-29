/**
 * Bulk photo upload screen — placeholder.
 *
 * TODO(#100): Implement the full bulk upload flow (image picker,
 * multi-photo queue, progress, submission to the backend).
 * This file exists so the accept wizard's "Bulk" CTA navigates to a
 * valid route after the request is accepted.
 */
import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'

export function DiaryBulkScreen() {
  const colors = useTheme()
  const { t } = useTranslation()
  const router = useRouter()
  const { requestId } = useLocalSearchParams<{ requestId: string }>()

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bg }]}
      edges={['top', 'bottom']}
    >
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

        {/* Placeholder content — replaced by bulk upload flow in #100 */}
        <View style={styles.placeholder}>
          <Text style={styles.icon}>📤</Text>
          <Text style={[Type.title3, { color: colors.label, textAlign: 'center' }]}>
            {t('diary.bulk.title')}
          </Text>
          <Text
            style={[
              Type.footnote,
              { color: colors.label2, marginTop: 8, textAlign: 'center' },
            ]}
          >
            {requestId}
          </Text>
          <Text
            style={[
              Type.caption1,
              { color: colors.label3, marginTop: 24, textAlign: 'center' },
            ]}
          >
            {t('diary.bulk.placeholder')}
          </Text>
        </View>
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
  icon: {
    fontSize: 48,
    marginBottom: 20,
  },
})

export default DiaryBulkScreen
