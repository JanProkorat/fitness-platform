import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { getQuestionnaireResponseById } from '@/api/questionnaire'
import type { SubmittedQuestionnaire, SubmittedAnswer } from '@/api/questionnaire'
import { AnswerValue } from './AnswerValue'

interface QuestionnaireResponseSheetProps {
  visible: boolean
  onClose: () => void
  responseId: string
}

export function QuestionnaireResponseSheet({
  visible,
  onClose,
  responseId,
}: QuestionnaireResponseSheetProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  const [data, setData] = useState<SubmittedQuestionnaire | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  // Fetch data when opened
  useEffect(() => {
    if (!visible || !responseId) return
    let cancelled = false
    setLoading(true)
    setError(false)
    ;(async () => {
      try {
        const res = await getQuestionnaireResponseById(responseId)
        if (!cancelled) setData(res)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [visible, responseId])

  const submittedDate = data?.submittedAt
    ? new Date(data.submittedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      heightFraction={0.85}
      headerRight={
        <Pressable onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={22} color={colors.label2} />
        </Pressable>
      }
    >
      {/* Custom header (not using title prop) */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.headerIconWrap, { backgroundColor: colors.goldBg }]}>
            <Ionicons name="clipboard-outline" size={18} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.label }]} numberOfLines={1}>
              {data?.questionnaireTitle ?? t('questionnaireResponse.title')}
            </Text>
            {submittedDate && (
              <Text style={[styles.headerDate, { color: colors.label3 }]}>
                {t('questionnaireResponse.submittedOn', { date: submittedDate })}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Content */}
      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={colors.gold} />
        </View>
      )}

      {error && !loading && (
        <View style={styles.centered}>
          <Text style={[Type.subheadline, { color: colors.label3 }]}>
            {t('questionnaireResponse.error')}
          </Text>
        </View>
      )}

      {!loading && !error && data && (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {data.answers.map((answer, idx) => (
            <View
              key={idx}
              style={[
                styles.answerCard,
                { backgroundColor: colors.bg2 },
                idx < data.answers.length - 1 && { marginBottom: 10 },
              ]}
            >
              <Text style={[styles.answerLabel, { color: colors.label2 }]}>
                {answer.label}
              </Text>
              <AnswerValue answer={answer} />
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </BottomSheet>
  )
}

export default QuestionnaireResponseSheet

// ─── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerTitle: {
    ...Type.headline,
    fontWeight: '600',
  },
  headerDate: {
    ...Type.caption1,
    marginTop: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 20,
  },
  answerCard: {
    borderRadius: Radius.sm,
    padding: 14,
  },
  answerLabel: {
    ...Type.caption1,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
})
