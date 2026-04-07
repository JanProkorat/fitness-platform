import React, { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../src/stores/auth'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { StatCard } from '@/components/ui/StatCard'
import { StatStrip } from '@/components/ui/StatStrip'
import { GoldButton } from '@/components/ui/GoldButton'
import { TrainingCard } from '@/components/training/TrainingCard'
import { NutritionCard } from '@/components/nutrition/NutritionCard'
import { BellButton } from '@/components/ui/BellButton'
import { NotificationSheet } from '@/components/notifications/NotificationSheet'
import { InviteCard } from '@/components/notifications/InviteCard'
import { InviteBanner } from '@/components/notifications/InviteBanner'
import { useNotifications } from '@/hooks/useNotifications'
import { useClientInvite } from '@/hooks/useClientInvite'
import { Toast } from '@/lib/toast'
import {
  getTodayPlan,
  getTodayLog,
  logMealEaten,
  type TodayPlanResponse,
  type TodayLogResponse,
} from '../../src/api/nutrition'
import { getTodaySession, type TodayTrainingResponse } from '../../src/api/training'

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

// ─── No Trainer State ─────────────────────────────────────────────────

function NoTrainerView() {
  const colors = useTheme()
  const router = useRouter()

  const features = [
    { icon: '🏋️', title: 'Training Plan', desc: 'Personalized workouts from your trainer' },
    { icon: '🥗', title: 'Nutrition Plan', desc: 'Custom meal plans and macro tracking' },
    { icon: '📊', title: 'Progress Tracking', desc: 'Track weight, measurements and goals' },
  ]

  return (
    <View style={styles.noTrainer}>
      {/* Info banner */}
      <View style={[styles.banner, { backgroundColor: colors.bg2, borderLeftColor: colors.gold }]}>
        <Text style={[Type.headline, { color: colors.label }]}>
          Get started with a trainer
        </Text>
        <Text style={[Type.subheadline, { color: colors.label2, marginTop: 4 }]}>
          Connect with a personal trainer or nutritionist to unlock your full potential.
        </Text>
      </View>

      <GoldButton
        title="Find a trainer"
        onPress={() => router.push('/(client)/discover')}
        style={styles.findCta}
      />

      {/* Feature preview */}
      <Text style={[Type.footnote, { color: colors.label3, marginBottom: 12, marginHorizontal: 16 }]}>
        WHAT YOU'LL GET
      </Text>
      {features.map((f) => (
        <View key={f.title} style={[styles.featureRow, { backgroundColor: colors.bg2 }]}>
          <Text style={styles.featureIcon}>{f.icon}</Text>
          <View style={styles.featureInfo}>
            <Text style={[Type.headline, { color: colors.label }]}>{f.title}</Text>
            <Text style={[Type.caption1, { color: colors.label2, marginTop: 2 }]}>{f.desc}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────

export default function TodayScreen() {
  const colors = useTheme()
  const router = useRouter()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const hasTrainer = user?.hasActiveLink ?? false
  const [sheetOpen, setSheetOpen] = useState(false)
  const { data: pendingInviteBanner } = useQuery({
    queryKey: ['invite-banner'],
    queryFn: () => null as string | null,
    initialData: null,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })
  const dismissInviteBanner = () => queryClient.setQueryData(['invite-banner'], null)

  // Notifications
  const {
    notifications,
    unreadCount,
    markAllRead,
    markRead,
  } = useNotifications()

  // Pending invite
  const { invite, accept, decline } = useClientInvite(!hasTrainer)

  const handleNotificationAction = useCallback(
    (n: (typeof notifications)[0]) => {
      markRead(n.id)
      setSheetOpen(false)
      switch (n.type) {
        case 'invitation':
          break // invite card visible on Today
        case 'questionnaire':
          router.push('/(client)/questionnaire' as never)
          break
        case 'new_plan':
          if (n.actionPayload?.planId) {
            router.push(`/(client)/plans/${n.actionPayload.planId}` as never)
          }
          break
        case 'message':
          if (n.actionPayload?.threadId) {
            router.push(`/(client)/messages/${n.actionPayload.threadId}` as never)
          }
          break
      }
    },
    [markRead, router],
  )

  const handleNotificationDismiss = useCallback(
    (n: (typeof notifications)[0]) => {
      markRead(n.id)
    },
    [markRead],
  )

  // Queries — only fetch when user has a trainer
  const planQuery = useQuery<TodayPlanResponse>({
    queryKey: ['today-plan'],
    queryFn: getTodayPlan,
    enabled: hasTrainer,
  })

  const logQuery = useQuery<TodayLogResponse>({
    queryKey: ['today-log'],
    queryFn: getTodayLog,
    enabled: hasTrainer,
  })

  const trainingQuery = useQuery<TodayTrainingResponse>({
    queryKey: ['today-training'],
    queryFn: getTodaySession,
    enabled: hasTrainer,
  })

  const eatenMealIds = useMemo(() => {
    const set = new Set<string>()
    logQuery.data?.mealsEaten?.forEach((m) => set.add(m.mealId))
    return set
  }, [logQuery.data])

  const markEatenMutation = useMutation({
    mutationFn: logMealEaten,
    onMutate: async (mealId: string) => {
      await queryClient.cancelQueries({ queryKey: ['today-log'] })
      const previous = queryClient.getQueryData<TodayLogResponse>(['today-log'])
      if (previous) {
        const meal = planQuery.data?.meals.find((m) => m.mealId === mealId)
        const totals = meal?.mealTotals ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
        queryClient.setQueryData<TodayLogResponse>(['today-log'], {
          ...previous,
          mealsEaten: [
            ...previous.mealsEaten,
            { mealId, mealName: meal?.name ?? '', eatenAt: new Date().toISOString(), totals },
          ],
          totalConsumed: {
            kcal: previous.totalConsumed.kcal + totals.kcal,
            protein: previous.totalConsumed.protein + totals.protein,
            carbs: previous.totalConsumed.carbs + totals.carbs,
            fat: previous.totalConsumed.fat + totals.fat,
            fiber: previous.totalConsumed.fiber + totals.fiber,
          },
        })
      }
      return { previous }
    },
    onError: (_err, _mealId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['today-log'], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['today-plan'] })
      queryClient.invalidateQueries({ queryKey: ['today-log'] })
    },
  })

  const handleMarkEaten = useCallback(
    (mealId: string) => markEatenMutation.mutate(mealId),
    [markEatenMutation],
  )

  const isLoading = hasTrainer && (planQuery.isLoading || logQuery.isLoading || trainingQuery.isLoading)
  const isRefreshing = planQuery.isRefetching || logQuery.isRefetching || trainingQuery.isRefetching

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['today-plan'] })
    queryClient.invalidateQueries({ queryKey: ['today-log'] })
    queryClient.invalidateQueries({ queryKey: ['today-training'] })
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
    queryClient.invalidateQueries({ queryKey: ['client-invite'] })
  }, [queryClient])

  const plan = planQuery.data
  const log = logQuery.data
  const training = trainingQuery.data
  const consumed = log?.totalConsumed ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  const settings = plan?.globalSettings
  const targetKcal = settings?.dailyKcal ?? 0

  const sortedMeals = useMemo(
    () => [...(plan?.meals ?? [])].sort((a, b) => a.order - b.order),
    [plan?.meals],
  )

  const totalSets = useMemo(
    () => training?.session?.exercises.reduce((sum, e) => sum + e.sets.length, 0) ?? 0,
    [training?.session],
  )

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.gold} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[Type.largeTitle, { color: colors.label }]}>
              Hi, {user?.firstName} 👋
            </Text>
          </View>
          <BellButton
            count={unreadCount}
            onPress={() => setSheetOpen(true)}
          />
        </View>

        {/* Invite arrival banner */}
        {pendingInviteBanner && (
          <InviteBanner
            trainerName={pendingInviteBanner}
            onPress={() => {
              dismissInviteBanner()
              // Scroll to the invite card below
            }}
            onDismiss={dismissInviteBanner}
          />
        )}

        {/* Pending invite */}
        {invite && (
          <InviteCard
            invite={invite}
            onAccept={() => {
              accept(invite.id)
              Toast.show('Invitation accepted \u2713')
            }}
            onDecline={() => decline(invite.id)}
          />
        )}

        {!hasTrainer ? (
          <NoTrainerView />
        ) : (
          <>
            {/* Stat strip */}
            <StatStrip>
              <StatCard
                label="Calories"
                value={Math.round(consumed.kcal)}
                sub={targetKcal > 0 ? `/ ${targetKcal}` : undefined}
                color={colors.gold}
              />
              <StatCard
                label="Training"
                value={training?.session?.name ?? 'Rest day'}
                sub={training?.hasSession ? 'Today' : undefined}
              />
              <StatCard
                label="Streak"
                value="🔥 0"
                color={colors.orange}
              />
            </StatStrip>

            {/* Today's training */}
            {training?.hasSession && training.session && (
              <View style={styles.section}>
                <SectionHeader title="Today's Training" />
                <TrainingCard
                  planName={training.planName ?? 'Training Plan'}
                  session={training.session}
                  totalSets={totalSets}
                  onContinue={() => {
                    if (training.session) {
                      router.push(
                        `/(client)/training/session/${training.session.sessionId}` as never,
                      )
                    }
                  }}
                />
              </View>
            )}

            {/* Today's nutrition */}
            {plan && (
              <View style={styles.section}>
                <SectionHeader
                  title="Today's Nutrition"
                  actionLabel={`${eatenMealIds.size}/${sortedMeals.length}`}
                />
                <NutritionCard
                  consumed={consumed}
                  targets={{
                    kcal: targetKcal,
                    protein: settings?.proteinGrams ?? 0,
                    carbs: settings?.carbsGrams ?? 0,
                    fat: settings?.fatGrams ?? 0,
                    fiber: settings?.fiberGrams ?? 0,
                  }}
                  meals={sortedMeals}
                  eatenMealIds={eatenMealIds}
                  onMealPress={(mealId) =>
                    router.push(`/(client)/nutrition/${mealId}` as never)
                  }
                  onMarkEaten={handleMarkEaten}
                />
              </View>
            )}

            {/* Empty state: has trainer but no plans yet */}
            {!plan && !training?.hasSession && (
              <View style={[styles.emptyCard, { backgroundColor: colors.bg2 }]}>
                <Text style={{ fontSize: 40 }}>📋</Text>
                <Text style={[Type.headline, { color: colors.label, marginTop: 12 }]}>
                  No plans yet
                </Text>
                <Text style={[Type.subheadline, { color: colors.label2, marginTop: 4, textAlign: 'center' }]}>
                  Your trainer hasn't created any plans for you yet. Check back soon!
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <NotificationSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        notifications={notifications}
        onMarkAllRead={markAllRead}
        onAction={handleNotificationAction}
        onDismiss={handleNotificationDismiss}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  section: {
    marginTop: 24,
  },
  // No trainer
  noTrainer: {
    paddingTop: 8,
  },
  banner: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: Radius.md,
    borderLeftWidth: 4,
  },
  findCta: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: Radius.md,
  },
  featureIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  featureInfo: {
    flex: 1,
  },
  emptyCard: {
    margin: 16,
    borderRadius: Radius.md,
    padding: 32,
    alignItems: 'center',
  },
})
