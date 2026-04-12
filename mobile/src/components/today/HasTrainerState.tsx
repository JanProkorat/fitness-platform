import React, { useCallback, useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { StatStrip } from '@/components/ui/StatStrip'
import { StatCard } from '@/components/ui/StatCard'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Badge } from '@/components/ui/Badge'
import { TrainingCard } from '@/components/training/TrainingCard'
import { NutritionCard } from '@/components/nutrition/NutritionCard'
import { PrepTipsSection } from '@/components/today/PrepTipsSection'
import { WaitingForPlanCard } from '@/components/today/WaitingForPlanCard'
import { ShoppingPrepBanner } from '@/components/today/ShoppingPrepBanner'
import {
  getTodayPlan,
  getTodayLog,
  logMealEaten,
  getFullPlan,
  type TodayPlanResponse,
  type TodayLogResponse,
  type FullPlanResponse,
} from '@/api/nutrition'
import { getTodaySession, type TodayTrainingResponse } from '@/api/training'
import {
  getComplianceScore,
  getCollaborations,
  type ComplianceScoreResponse,
  type CollaborationDto,
} from '@/api/profile'

// ─── Component ──────────────────────────────────────────────────────

export function HasTrainerState() {
  const colors = useTheme()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  // ── Queries ──
  const planQuery = useQuery<TodayPlanResponse>({
    queryKey: ['today-plan'],
    queryFn: getTodayPlan,
  })

  const logQuery = useQuery<TodayLogResponse>({
    queryKey: ['today-log'],
    queryFn: getTodayLog,
  })

  const trainingQuery = useQuery<TodayTrainingResponse>({
    queryKey: ['today-training'],
    queryFn: getTodaySession,
  })

  const streakQuery = useQuery<ComplianceScoreResponse>({
    queryKey: ['compliance-score'],
    queryFn: () => getComplianceScore(),
    retry: false,
  })

  const collabQuery = useQuery<CollaborationDto[]>({
    queryKey: ['collaborations'],
    queryFn: getCollaborations,
  })

  const fullPlanQuery = useQuery<FullPlanResponse>({
    queryKey: ['nutrition', 'full-plan'],
    queryFn: getFullPlan,
    staleTime: 60_000,
  })

  // ── Derived data ──
  const plan = planQuery.data
  const log = logQuery.data
  const training = trainingQuery.data
  const streak = streakQuery.data?.currentStreak ?? 0

  const consumed = log?.totalConsumed ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  const settings = plan?.globalSettings
  const targetKcal = settings?.dailyKcal ?? 0
  const kcalProgress = targetKcal > 0 ? consumed.kcal / targetKcal : 0

  // ── Waiting-for-plan logic ──
  const collabs = collabQuery.data ?? []
  const hasTrainerLink = collabs.some((c) => c.role === 'Trainer')
  const hasNutritionistLink = collabs.some((c) => c.role === 'Nutritionist')
  const waitingForTraining = !training?.hasSession && hasTrainerLink
  const waitingForNutrition = !plan && hasNutritionistLink
  const isWaitingForAnyPlan = waitingForTraining || waitingForNutrition

  // ── Next-week shopping prep banner ──
  const showShoppingBanner = useMemo(() => {
    const fp = fullPlanQuery.data
    if (!fp?.currentWeek || !fp.currentDayOfWeek) return null
    // Only show on Friday (5), Saturday (6), or Sunday (7)
    if (fp.currentDayOfWeek < 5) return null
    const nextWeek = fp.currentWeek + 1
    // Check if next week is published
    if (nextWeek > fp.publishedWeekCount) return null
    return nextWeek
  }, [fullPlanQuery.data])

  const eatenMealIds = useMemo(() => {
    const set = new Set<string>()
    logQuery.data?.mealsEaten?.forEach((m) => set.add(m.mealId))
    return set
  }, [logQuery.data])

  const sortedMeals = useMemo(
    () => [...(plan?.meals ?? [])].sort((a, b) => a.order - b.order),
    [plan?.meals],
  )

  const totalSets = useMemo(
    () => training?.session?.exercises.reduce((sum, e) => sum + e.sets.length, 0) ?? 0,
    [training?.session],
  )

  const exerciseCount = training?.session?.exercises.length ?? 0

  // ── Training card subtitle ──
  const trainingPlanSubtitle = useMemo(() => {
    const parts: string[] = []
    if (training?.planName) parts.push(training.planName)
    if (training?.currentWeek) parts.push(t('today.weekNumber', { week: training.currentWeek }))
    return parts.join(' \u00b7 ')
  }, [training, t])

  // ── Stat card: training sub text ──
  const trainingSubText = useMemo(() => {
    if (!training?.hasSession || !training.session) return undefined
    return t('today.exercisesCount', { count: exerciseCount })
  }, [training, exerciseCount, t])

  // ── Mutation: mark meal eaten ──
  const markEatenMutation = useMutation({
    mutationFn: logMealEaten,
    onMutate: async (mealId: string) => {
      await queryClient.cancelQueries({ queryKey: ['today-log'] })
      const previous = queryClient.getQueryData<TodayLogResponse>(['today-log'])
      if (previous) {
        const meal = plan?.meals.find((m) => m.mealId === mealId)
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

  // ── Render ──
  return (
    <>
      {/* Stat strip */}
      <StatStrip>
        <StatCard
          label={t('today.calories')}
          value={Math.round(consumed.kcal)}
          sub={targetKcal > 0 ? `/ ${targetKcal} kcal` : undefined}
          color={colors.gold}
          progress={kcalProgress}
          progressColor={colors.gold}
        />
        <StatCard
          label={t('today.training')}
          value={training?.session?.name ?? t('today.restDay')}
          sub={trainingSubText}
          icon={
            training?.hasSession ? (
              <Badge label={t('today.waiting')} variant="active" />
            ) : undefined
          }
        />
        <StatCard
          label={t('today.streak')}
          value={streak}
          sub={t('today.daysInRow')}
          color={colors.orange}
          icon={<Text style={{ fontSize: 18 }}>🔥</Text>}
        />
      </StatStrip>

      {/* Today's training */}
      {training?.hasSession && training.session && (
        <View style={styles.section}>
          <SectionHeader title={t('today.todaysTraining')} />
          <TrainingCard
            planName={trainingPlanSubtitle || t('today.trainingPlan')}
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
            title={t('today.todaysNutrition')}
            actionLabel={t('today.mealsProgress', {
              done: eatenMealIds.size,
              total: sortedMeals.length,
            })}
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

      {/* Next-week shopping prep banner */}
      {showShoppingBanner !== null && (
        <View style={styles.section}>
          <ShoppingPrepBanner week={showShoppingBanner} />
        </View>
      )}

      {/* Waiting for plan card */}
      {isWaitingForAnyPlan && (
        <View style={styles.section}>
          <WaitingForPlanCard
            waitingForTraining={waitingForTraining}
            waitingForNutrition={waitingForNutrition}
            hasExistingPlan={!!plan || !!training?.hasSession}
          />
        </View>
      )}

      {/* Prep tips when waiting */}
      {isWaitingForAnyPlan && (
        <View style={styles.section}>
          <PrepTipsSection
            hasTraining={waitingForTraining}
            hasNutrition={waitingForNutrition}
          />
        </View>
      )}
    </>
  )
}

export default HasTrainerState

const styles = StyleSheet.create({
  section: {
    marginTop: 24,
  },
})
