/**
 * Diary Dismiss Screen — confirm + optional reason sheet.
 *
 * Per prototype docs/prototypes/mobile/scenes/diary-dismiss.html:
 *   1. Modal-style header: screen title + "Cancel" (close) button.
 *   2. Warning block: orange tint with ⚠️ icon + explanation copy.
 *   3. Optional reason textarea with character counter (max 500).
 *   4. Pinned action bar: "Dismiss request" (red) + "Cancel" (secondary).
 *
 * Route params: requestId (from [requestId] parent segment).
 *
 * Submit flow:
 *   dismissDiaryRequest({ id, reason }) → toast → invalidate queries → Today.
 * Cancel: router.back() — no API call.
 */

import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { dismissDiaryRequest } from '@/api/diaryRequests'
import { Toast } from '@/lib/toast'
import { href } from '@/lib/navigation'

// ─── Constants ────────────────────────────────────────────────────────────────

const REASON_MAX_LENGTH = 500

// ─── Screen ──────────────────────────────────────────────────────────────────

export function DiaryDismissScreen() {
  const colors = useTheme()
  const { t } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { requestId } = useLocalSearchParams<{ requestId: string }>()

  const [reason, setReason] = useState('')

  // ── Dismiss mutation ──
  const dismissMutation = useMutation({
    mutationFn: () =>
      dismissDiaryRequest({ id: requestId ?? '', reason }),
    onSuccess: () => {
      Toast.show(t('diary.dismiss.successToast'))
      queryClient.invalidateQueries({ queryKey: ['pending-questionnaires'] })
      queryClient.invalidateQueries({ queryKey: ['active-workflow-diary-requests'] })
      router.replace(href('/(client)/(tabs)'))
    },
    onError: () => {
      Toast.show(t('diary.dismiss.errorDismiss'))
    },
  })

  const handleDismiss = useCallback(() => {
    dismissMutation.mutate()
  }, [dismissMutation])

  const handleCancel = useCallback(() => {
    router.back()
  }, [router])

  const isPending = dismissMutation.isPending

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bg }]}
      edges={['top', 'bottom']}
    >
      {/* ── Modal header ── */}
      <View style={[styles.header, { borderBottomColor: colors.sep2 }]}>
        <Pressable
          onPress={handleCancel}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('diary.dismiss.ctaCancel')}
          style={styles.headerSideBtn}
        >
          <Text style={[Type.subheadline, { color: colors.label2, fontWeight: '600' }]}>
            {t('diary.dismiss.ctaCancel')}
          </Text>
        </Pressable>
        <Text style={[Type.subheadline, { color: colors.label, fontWeight: '600' }]}>
          {t('diary.dismiss.screenTitle')}
        </Text>
        {/* Spacer to balance the left button */}
        <View style={styles.headerSideBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Warning block ── */}
        <View
          style={[
            styles.warningBlock,
            { backgroundColor: colors.fill, borderColor: colors.sep2 },
          ]}
        >
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text
            style={[
              Type.footnote,
              styles.warningText,
              { color: colors.label2 },
            ]}
          >
            {t('diary.dismiss.warningText')}
          </Text>
        </View>

        {/* ── Reason textarea ── */}
        <View style={styles.reasonSection}>
          <View style={styles.reasonLabelRow}>
            <Text
              style={[
                Type.footnote,
                styles.reasonLabel,
                { color: colors.label2 },
              ]}
            >
              {t('diary.dismiss.reasonLabel')}
            </Text>
            <Text style={[Type.caption1, { color: colors.label3 }]}>
              {t('diary.dismiss.charCount', {
                count: reason.length,
                max: REASON_MAX_LENGTH,
              })}
            </Text>
          </View>

          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: colors.bg2,
                borderColor: colors.sep2,
                color: colors.label,
              },
            ]}
            placeholder={t('diary.dismiss.reasonPlaceholder')}
            placeholderTextColor={colors.label3}
            multiline
            textAlignVertical="top"
            maxLength={REASON_MAX_LENGTH}
            value={reason}
            onChangeText={setReason}
            editable={!isPending}
            returnKeyType="default"
            accessibilityLabel={t('diary.dismiss.reasonLabel')}
          />
        </View>
      </ScrollView>

      {/* ── Pinned action bar ── */}
      <View
        style={[
          styles.actionBar,
          {
            backgroundColor: colors.bg,
            borderTopColor: colors.sep2,
          },
        ]}
      >
        {/* Primary: Dismiss (red) */}
        <Pressable
          onPress={handleDismiss}
          disabled={isPending}
          accessibilityRole="button"
          accessibilityLabel={t('diary.dismiss.ctaDismiss')}
          style={({ pressed }) => [
            styles.ctaDismiss,
            {
              backgroundColor: colors.red,
              opacity: pressed || isPending ? 0.7 : 1,
            },
          ]}
        >
          {isPending ? (
            <ActivityIndicator color={colors.onAccent} size="small" />
          ) : (
            <Text style={[Type.subheadline, styles.ctaDismissText, { color: colors.onAccent }]}>
              {t('diary.dismiss.ctaDismiss')}
            </Text>
          )}
        </Pressable>

        {/* Secondary: Cancel */}
        <Pressable
          onPress={handleCancel}
          disabled={isPending}
          accessibilityRole="button"
          accessibilityLabel={t('diary.dismiss.ctaCancel')}
          style={({ pressed }) => [
            styles.ctaCancel,
            {
              backgroundColor: colors.fill,
              borderColor: colors.sep2,
              opacity: pressed || isPending ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[Type.subheadline, styles.ctaCancelText, { color: colors.label }]}>
            {t('diary.dismiss.ctaCancel')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 4 : 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSideBtn: {
    minWidth: 56,
  },

  // Scroll content
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },

  // Warning block
  warningBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  warningIcon: {
    fontSize: 20,
    flexShrink: 0,
  },
  warningText: {
    flex: 1,
    lineHeight: 20,
  },

  // Reason section
  reasonSection: {
    marginTop: 24,
  },
  reasonLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  reasonLabel: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    minHeight: 110,
    ...Type.subheadline,
    lineHeight: 22,
  },

  // Action bar
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ctaDismiss: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radius.md,
    minHeight: 48,
  },
  ctaDismissText: {
    fontWeight: '600',
  },
  ctaCancel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  ctaCancelText: {
    fontWeight: '600',
  },
})

export default DiaryDismissScreen
