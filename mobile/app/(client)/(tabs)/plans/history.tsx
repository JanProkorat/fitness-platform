import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, Stack } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { hrefParams } from '@/lib/navigation'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { useAuthStore } from '@/stores/auth'
import {
  getClientPlans,
  type ClientPlanSummary,
  type PlanStatus,
} from '@/api/nutrition'

function formatDate(isoDate: string | null): string {
  if (!isoDate) return ''
  try {
    const d = new Date(isoDate)
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

function CompletedPlanCard({
  plan,
  onPress,
}: {
  plan: ClientPlanSummary
  onPress: () => void
}) {
  const colors = useTheme()
  const { t } = useTranslation()

  const isTraining = plan.type === 'training'
  const gradientColors: [string, string] = isTraining
    ? [colors.trainingHeroStart, colors.trainingHeroEnd]
    : [colors.nutritionHeroStart, colors.nutritionHeroEnd]

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.cardPressable, { opacity: pressed ? 0.9 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={plan.planName ?? t('plans.completed')}
    >
      <View style={[styles.planCard, { backgroundColor: colors.bg2 }]}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.planHero, { opacity: 0.85 }]}
        >
          <View style={[styles.statusTag, { backgroundColor: 'rgba(201,168,76,0.2)' }]}>
            <Text style={[styles.statusTagText, { color: colors.gold }]}>
              {`✓ ${t('plans.completed')}`}
            </Text>
          </View>
          <Text style={styles.planTypeLabel}>
            {isTraining ? t('plans.trainingPlanType') : t('plans.nutritionPlanType')}
          </Text>
          <Text style={styles.planName}>{plan.planName ?? ''}</Text>
          {(plan.totalWeeks ?? 0) > 0 && (
            <Text style={styles.planSubtitle}>
              {t('plans.weeksCount', { count: plan.totalWeeks ?? 0 })}
            </Text>
          )}
          {plan.dateCompleted && (
            <Text style={styles.planSubtitle}>
              {t('plans.completedOn', { date: formatDate(plan.dateCompleted) })}
            </Text>
          )}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '100%', backgroundColor: colors.gold }]} />
          </View>
          <Text style={styles.planProgressLabel}>
            {t('plans.weekOf', { current: plan.totalWeeks ?? 0, total: plan.totalWeeks ?? 0 })} ✓
          </Text>
        </LinearGradient>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.label }]}>
              {plan.publishedWeekCount ?? 0}
            </Text>
            <Text style={[styles.statDesc, { color: colors.label3 }]}>{t('plans.published')}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.sep2 }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.label }]}>
              {plan.totalWeeks ?? 0}
            </Text>
            <Text style={[styles.statDesc, { color: colors.label3 }]}>{t('plans.totalWeeksLabel')}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  )
}

export default function PlansHistoryScreen() {
  const colors = useTheme()
  const { t } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()
  const hasTrainer = useAuthStore((s) => s.user?.hasActiveLink ?? false)

  const archiveQuery = useQuery({
    queryKey: ['client-plans-completed'],
    queryFn: () => getClientPlans('Completed' as PlanStatus),
    enabled: hasTrainer,
  })

  const isRefreshing = archiveQuery.isRefetching

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['client-plans-completed'] })
  }, [queryClient])

  const archivedPlans = archiveQuery.data?.items ?? []

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
        >
          <Ionicons name="chevron-back" size={24} color={colors.blue} />
        </Pressable>
        <Text style={[Type.headline, { color: colors.label }]}>{t('plans.archive')}</Text>
        <View style={styles.backBtn} />
      </View>

      {archiveQuery.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.gold}
            />
          }
        >
          {archivedPlans.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.bg2 }]}>
              <Text style={{ fontSize: 40 }}>📁</Text>
              <Text style={[Type.headline, { color: colors.label, marginTop: 12 }]}>
                {t('plans.noArchived')}
              </Text>
              <Text
                style={[
                  Type.subheadline,
                  { color: colors.label2, marginTop: 4, textAlign: 'center' },
                ]}
              >
                {t('plans.noArchivedDesc')}
              </Text>
            </View>
          ) : (
            archivedPlans.map((plan) => (
              <View key={plan.planId} style={styles.cardWrap}>
                <CompletedPlanCard
                  plan={plan}
                  onPress={() =>
                    router.push(
                      hrefParams('/(client)/plans/[planId]', {
                        planId: plan.planId ?? '',
                        type: plan.type ?? '',
                      }),
                    )
                  }
                />
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    paddingBottom: 100,
  },
  cardWrap: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  cardPressable: {},
  planCard: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  planHero: {
    padding: 20,
  },
  statusTag: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  planTypeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  planName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  planSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 3,
  },
  planProgressLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    ...Type.title3,
  },
  statDesc: {
    ...Type.caption2,
    marginTop: 2,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  emptyCard: {
    margin: 16,
    borderRadius: Radius.md,
    padding: 32,
    alignItems: 'center',
  },
})
