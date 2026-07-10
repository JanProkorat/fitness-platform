/**
 * Diary request dismiss screen.
 *
 * Reached from the wizard's Revoke button. The client can optionally type
 * a reason (max 500 chars — matches the backend validator) before
 * confirming. Submit fires `dismissDiaryRequest({ id, reason })`; the
 * trimmed reason is omitted from the request body when empty.
 *
 * Header mirrors the wizard: gold chevron-back + "Zpět" label, centered
 * "Foto-deník" title. Back returns to the wizard so the client can change
 * their mind.
 */
import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { Toast } from '@/lib/toast'
import { useDiaryStore } from '@/stores/diaryStore'
import { dismissDiaryRequest } from '@/api/diaryRequests'

const REASON_MAX = 500

export function DiaryDismissScreen() {
  const colors = useTheme()
  const { t } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { clearSelection } = useDiaryStore()

  const { requestId } = useLocalSearchParams<{ requestId: string }>()
  const [reason, setReason] = useState('')

  const dismissMutation = useMutation({
    mutationFn: () => dismissDiaryRequest({ id: requestId, reason }),
    onSuccess: () => {
      clearSelection(requestId)
      queryClient.invalidateQueries({ queryKey: ['pending-questionnaires'] })
      queryClient.invalidateQueries({ queryKey: ['active-diary-requests'] })
      Toast.show(t('diary.dismiss.successToast'))
      router.replace('/(client)')
    },
    onError: () => {
      Toast.show(t('diary.dismiss.errorDismiss'))
    },
  })

  const isLoading = dismissMutation.isPending

  const handleSubmit = useCallback(() => {
    if (isLoading) return
    dismissMutation.mutate()
  }, [dismissMutation, isLoading])

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bg }]}
      edges={['top', 'bottom']}
    >
      {/* ── Header ────────────────────────────────────────────────── */}
      <View style={[styles.header, { borderBottomColor: colors.sep2 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.5 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={26} color={colors.gold} />
          <Text style={[Type.body, styles.backLabel, { color: colors.gold }]}>
            {t('common.back')}
          </Text>
        </Pressable>

        <Text
          style={[Type.headline, styles.headerTitle, { color: colors.label }]}
          numberOfLines={1}
        >
          {t('diary.dismiss.screenTitle')}
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Body ─────────────────────────────────────────────────── */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.warning, { color: colors.label2 }]}>
            {t('diary.dismiss.warningText')}
          </Text>

          <Text style={[Type.caption1, styles.label, { color: colors.label3 }]}>
            {t('diary.dismiss.reasonLabel')}
          </Text>
          <TextInput
            value={reason}
            onChangeText={(v) => v.length <= REASON_MAX && setReason(v)}
            placeholder={t('diary.dismiss.reasonPlaceholder')}
            placeholderTextColor={colors.label3}
            multiline
            textAlignVertical="top"
            style={[
              styles.textarea,
              {
                backgroundColor: colors.bg2,
                borderColor: colors.sep2,
                color: colors.label,
              },
            ]}
          />
          <Text style={[Type.caption2, styles.charCount, { color: colors.label3 }]}>
            {t('diary.dismiss.charCount', {
              count: reason.length,
              max: REASON_MAX,
            })}
          </Text>
        </ScrollView>

        {/* ── Action bar ──────────────────────────────────────────── */}
        <View
          style={[
            styles.actionBar,
            { backgroundColor: colors.bg, borderTopColor: colors.sep2 },
          ]}
        >
          <Pressable
            onPress={handleSubmit}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.ctaPrimary,
              {
                backgroundColor: colors.gold,
                opacity: isLoading ? 0.45 : pressed ? 0.8 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: isLoading }}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={[styles.ctaPrimaryLabel, { color: colors.onAccent }]}>
                {t('diary.dismiss.ctaDismiss')}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const HEADER_SIDE_WIDTH = 92

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: HEADER_SIDE_WIDTH,
    paddingVertical: 6,
  },
  backLabel: {
    fontWeight: '600',
    marginLeft: -2,
  },
  headerTitle: {
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: HEADER_SIDE_WIDTH,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },

  warning: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  label: {
    fontWeight: '500',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  textarea: {
    minHeight: 140,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 20,
  },
  charCount: {
    marginTop: 6,
    textAlign: 'right',
  },

  actionBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 0.5,
    gap: 10,
  },
  ctaPrimary: {
    height: 50,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPrimaryLabel: {
    ...Type.subheadline,
    fontWeight: '600',
  },
})

export default DiaryDismissScreen
