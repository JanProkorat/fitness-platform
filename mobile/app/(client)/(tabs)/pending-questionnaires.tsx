import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, Stack } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { hrefParams } from '@/lib/navigation'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { Avatar } from '@/components/ui/Avatar'
import { GoldButton } from '@/components/ui/GoldButton'
import {
  getPendingQuestionnaires,
  type PendingQuestionnaireItem,
} from '@/api/questionnaire'

// ─── Coach Card ─────────────────────────────────────────────────────

function CoachQuestionnaireCard({
  item,
  onFill,
}: {
  item: PendingQuestionnaireItem
  onFill: () => void
}) {
  const colors = useTheme()
  const { t } = useTranslation()

  const roleLabel =
    item.professionalRole === 'Trainer'
      ? t('collab.trainer')
      : item.professionalRole === 'Nutritionist'
        ? t('collab.nutritionCoach')
        : item.professionalRole ?? ''

  const statusIsInProgress = item.responseStatus === 'InProgress'

  return (
    <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
      {/* Coach header */}
      <View style={styles.cardHeader}>
        <Avatar name={item.professionalName ?? ''} size="lg" />
        <View style={styles.cardInfo}>
          <Text style={[Type.headline, { color: colors.label }]}>
            {item.professionalName}
          </Text>
          <Text style={[Type.caption1, { color: colors.label2, marginTop: 1 }]}>
            {roleLabel}
          </Text>
        </View>
      </View>

      {/* Questionnaire info */}
      {item.questionnaireTitle && (
        <View style={[styles.questionnaireInfo, { borderTopColor: colors.sep2 }]}>
          <View style={styles.questionnaireRow}>
            <Text style={{ fontSize: 18 }}>📋</Text>
            <View style={{ flex: 1 }}>
              <Text style={[Type.body, { color: colors.label }]}>
                {item.questionnaireTitle}
              </Text>
              <Text style={[Type.caption1, { color: colors.label3, marginTop: 2 }]}>
                {item.questionCount} {t('questionnaire.questions')}
              </Text>
            </View>
          </View>

          {statusIsInProgress && (
            <View style={[styles.statusChip, { backgroundColor: colors.gold + '18' }]}>
              <View style={[styles.statusDot, { backgroundColor: colors.gold }]} />
              <Text style={[Type.caption1, { color: colors.gold, fontWeight: '600' }]}>
                {t('pendingQuestionnaires.inProgress')}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* CTA */}
      <View style={styles.cardFooter}>
        <GoldButton
          title={
            statusIsInProgress
              ? t('pendingQuestionnaires.continue')
              : t('pendingQuestionnaires.fill')
          }
          onPress={onFill}
        />
      </View>
    </View>
  )
}

// ─── Main Screen ────────────────────────────────────────────────────

export default function PendingQuestionnairesScreen() {
  const colors = useTheme()
  const router = useRouter()
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['pending-questionnaires'],
    queryFn: getPendingQuestionnaires,
  })

  const items = data?.items ?? []

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Nav bar */}
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.gold} />
          <Text style={[Type.body, { color: colors.gold }]}>{t('common.back')}</Text>
        </Pressable>
      </View>

      <View style={styles.titleBlock}>
        <Text style={[Type.largeTitle, { color: colors.label }]}>
          {t('pendingQuestionnaires.title')}
        </Text>
        <Text style={[Type.subheadline, { color: colors.label2, marginTop: 4 }]}>
          {t('pendingQuestionnaires.subtitle')}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 48 }}>✅</Text>
          <Text style={[Type.headline, { color: colors.label, marginTop: 16 }]}>
            {t('pendingQuestionnaires.allDone')}
          </Text>
          <Text
            style={[
              Type.subheadline,
              { color: colors.label2, marginTop: 4, textAlign: 'center', paddingHorizontal: 32 },
            ]}
          >
            {t('pendingQuestionnaires.allDoneDesc')}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Count badge */}
          <View style={[styles.countBadge, { backgroundColor: colors.goldBg }]}>
            <Text style={[Type.footnote, { color: colors.gold, fontWeight: '600' }]}>
              {t('pendingQuestionnaires.count', { count: items.length })}
            </Text>
          </View>

          {items.map((item) => (
            <CoachQuestionnaireCard
              key={item.linkPublicId}
              item={item}
              onFill={() => {
                router.push(hrefParams('/(auth)/questionnaire', { linkPublicId: item.linkPublicId ?? '' }))
              }}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  titleBlock: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  countBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    marginBottom: 16,
  },
  // Card
  card: {
    borderRadius: Radius.lg,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  cardInfo: {
    flex: 1,
  },
  questionnaireInfo: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  questionnaireRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cardFooter: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
})
