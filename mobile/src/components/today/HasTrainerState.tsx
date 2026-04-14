import React, { useCallback, useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { href } from '@/lib/navigation'
import { StatStrip } from '@/components/ui/StatStrip'
import { StatCard } from '@/components/ui/StatCard'
import { WeightStatCard } from '@/components/today/WeightStatCard'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Badge } from '@/components/ui/Badge'
import { TrainingCard } from '@/components/training/TrainingCard'
import { NutritionCard } from '@/components/nutrition/NutritionCard'
import { WaitingForPlanCard } from '@/components/today/WaitingForPlanCard'
import { ShoppingPrepBanner } from '@/components/today/ShoppingPrepBanner'
import {
  getTodayPlan,
  getTodayLog,
  logMealEaten,
  unlogMealEaten,
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
import { getMeasurementStats, getMeasurements, type MeasurementStatsResponse } from '@/api/measurements'

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

  const statsQuery = useQuery<MeasurementStatsResponse>({
    queryKey: ['measurement-stats'],
    queryFn: getMeasurementStats,
    retry: false,
  })

  const recentMeasurementsQuery = useQuery({
    queryKey: ['measurements-recent-7'],
    queryFn: () => getMeasurements({ pageSize: 7 }),
    retry: false,
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

  // Weight trend from measurement stats
  const weightTrend = useMemo(() => {
    const stats = statsQuery.data
    if (!stats?.latestWeight) return null
    const change = stats.weightChange30Days ?? null
    return { latest: stats.latestWeight, change }
  }, [statsQuery.data])

  // Recent weight entries for sparkline (last 7)
  const recentWeightEntries = useMemo(() => {
    const items = recentMeasurementsQuery.data?.items ?? []
    return items
      .filter((m): m is typeof m & { weightKg: number } => m.weightKg != null)
      .map((m) => ({ date: m.measuredAt, weight: m.weightKg }))
      .reverse()
  }, [recentMeasurementsQuery.data])

  const consumed = log?.totalConsumed ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  const settings = plan?.globalSettings
  const dayTotals = plan?.dayTotals
  // Prefer explicit daily macro targets from globalSettings; otherwise fall
  // back to the sum of macros planned for the day (dayTotals). This makes the
  // macro progress bars meaningful even for plans without explicit targets.
  const nutritionTargets = useMemo(
    () => ({
      kcal: settings?.dailyKcal ?? dayTotals?.kcal ?? 0,
      protein: settings?.proteinGrams ?? dayTotals?.protein ?? 0,
      carbs: settings?.carbsGrams ?? dayTotals?.carbs ?? 0,
      fat: settings?.fatGrams ?? dayTotals?.fat ?? 0,
      fiber: settings?.fiberGrams ?? dayTotals?.fiber ?? 0,
    }),
    [settings, dayTotals],
  )
  // ── Waiting-for-plan logic ──
  const collabs = useMemo(() => collabQuery.data ?? [], [collabQuery.data])
  const { waitingForTraining, waitingForNutrition, isWaitingForAnyPlan } = useMemo(() => {
    const hasTrainerLink = collabs.some((c) => c.role === 'Trainer')
    const hasNutritionistLink = collabs.some((c) => c.role === 'Nutritionist')
    const wTraining = !training?.hasSession && hasTrainerLink
    const wNutrition = !plan && hasNutritionistLink
    return { waitingForTraining: wTraining, waitingForNutrition: wNutrition, isWaitingForAnyPlan: wTraining || wNutrition }
  }, [collabs, training?.hasSession, plan])

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

  // ── Mutation: toggle meal eaten/uneaten ──
  // `eaten: true`  → POST   /client/nutrition/log/meals/{id}/eaten
  // `eaten: false` → DELETE /client/nutrition/log/meals/{id}/eaten
  // Optimistically adds / removes the meal from today's log in cache.
  const toggleEatenMutation = useMutation({
    mutationFn: async ({ mealId, eaten }: { mealId: string; eaten: boolean }) => {
      if (eaten) await logMealEaten(mealId)
      else await unlogMealEaten(mealId)
    },
    onMutate: async ({ mealId, eaten }) => {
      await queryClient.cancelQueries({ queryKey: ['today-log'] })
      const previous = queryClient.getQueryData<TodayLogResponse>(['today-log'])
      if (previous) {
        const meal = plan?.meals.find((m) => m.mealId === mealId)
        const totals = meal?.mealTotals ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
        if (eaten) {
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
        } else {
          // Remove every entry for this meal (there can be more than one if
          // the user double-logged before). Subtract all of their totals.
          const removed = previous.mealsEaten.filter((m) => m.mealId === mealId)
          const kept = previous.mealsEaten.filter((m) => m.mealId !== mealId)
          const removedTotals = removed.reduce(
            (sum, m) => ({
              kcal: sum.kcal + m.totals.kcal,
              protein: sum.protein + m.totals.protein,
              carbs: sum.carbs + m.totals.carbs,
              fat: sum.fat + m.totals.fat,
              fiber: sum.fiber + m.totals.fiber,
            }),
            { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
          )
          // Clamp to 0 — float subtraction of the same values we added can
          // leave behind tiny residues (e.g. -1.4e-14 or a signed zero), which
          // Math.round turns into "-0" in the UI. Consumed totals are
          // physically non-negative, so `Math.max(0, …)` is safe.
          const clamp = (n: number): number => (n > 0 ? n : 0)
          queryClient.setQueryData<TodayLogResponse>(['today-log'], {
            ...previous,
            mealsEaten: kept,
            totalConsumed: {
              kcal: clamp(previous.totalConsumed.kcal - removedTotals.kcal),
              protein: clamp(previous.totalConsumed.protein - removedTotals.protein),
              carbs: clamp(previous.totalConsumed.carbs - removedTotals.carbs),
              fat: clamp(previous.totalConsumed.fat - removedTotals.fat),
              fiber: clamp(previous.totalConsumed.fiber - removedTotals.fiber),
            },
          })
        }
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['today-log'], context.previous)
      }
      // On failure, pull fresh server state so the UI reflects reality.
      queryClient.invalidateQueries({ queryKey: ['today-log'] })
    },
    onSuccess: () => {
      // Refresh streak only (cheap, backend-computed). The `today-log` cache
      // is already optimistically correct — see comment below — so we don't
      // invalidate it.
      queryClient.invalidateQueries({ queryKey: ['compliance-score'] })
    },
    // Intentionally NO success/settled invalidation of `today-log`: the
    // optimistic cache is already correct, and refetching would replace our
    // values with server totals that can differ by a rounding step (server
    // totals are computed from stored FoodsEaten, we use plan.mealTotals) —
    // that second update makes the hero ring/kcal flicker. Drift is
    // reconciled on the next natural refetch (tab focus, pull-to-refresh,
    // SignalR invalidation).
  })

  const handleToggleEaten = useCallback(
    (mealId: string) => {
      const currentlyEaten = eatenMealIds.has(mealId)
      toggleEatenMutation.mutate({ mealId, eaten: !currentlyEaten })
    },
    [toggleEatenMutation, eatenMealIds],
  )

  // ── Mutation: mark all remaining meals eaten (fan-out) ──
  // The backend has no batch endpoint today, so we parallelise
  // `logMealEaten` for every meal not yet logged. Optimistic update mirrors
  // the single-toggle path — we add each remaining meal to the cache with
  // its plan `mealTotals` and bump `totalConsumed` once. We intentionally do
  // NOT invalidate `today-log` on success: the server recomputes totals from
  // each log's stored `FoodsEaten` (per-food × grams), which rounds
  // differently from `plan.mealTotals` and would make consumed visibly jump
  // from the optimistic value to the server value when the batch settles.
  // Drift is reconciled on natural refetch (tab focus / pull-to-refresh).
  const markAllEatenMutation = useMutation({
    mutationFn: async (mealIds: string[]) => {
      await Promise.all(mealIds.map((id) => logMealEaten(id)))
    },
    onMutate: async (mealIds: string[]) => {
      await queryClient.cancelQueries({ queryKey: ['today-log'] })
      const previous = queryClient.getQueryData<TodayLogResponse>(['today-log'])
      if (previous && plan) {
        const now = new Date().toISOString()
        const newEntries = mealIds
          .map((id) => {
            const meal = plan.meals.find((m) => m.mealId === id)
            const totals = meal?.mealTotals ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
            return { mealId: id, mealName: meal?.name ?? '', eatenAt: now, totals }
          })
        const addedTotals = newEntries.reduce(
          (sum, e) => ({
            kcal: sum.kcal + e.totals.kcal,
            protein: sum.protein + e.totals.protein,
            carbs: sum.carbs + e.totals.carbs,
            fat: sum.fat + e.totals.fat,
            fiber: sum.fiber + e.totals.fiber,
          }),
          { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
        )
        queryClient.setQueryData<TodayLogResponse>(['today-log'], {
          ...previous,
          mealsEaten: [...previous.mealsEaten, ...newEntries],
          totalConsumed: {
            kcal: previous.totalConsumed.kcal + addedTotals.kcal,
            protein: previous.totalConsumed.protein + addedTotals.protein,
            carbs: previous.totalConsumed.carbs + addedTotals.carbs,
            fat: previous.totalConsumed.fat + addedTotals.fat,
            fiber: previous.totalConsumed.fiber + addedTotals.fiber,
          },
        })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['today-log'], context.previous)
      }
      queryClient.invalidateQueries({ queryKey: ['today-log'] })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-score'] })
    },
  })

  const handleMarkAllEaten = useCallback(() => {
    if (!plan) return
    const remaining = plan.meals
      .map((m) => m.mealId)
      .filter((id) => !eatenMealIds.has(id))
    if (remaining.length === 0) return
    markAllEatenMutation.mutate(remaining)
  }, [plan, eatenMealIds, markAllEatenMutation])

  // ── Render ──
  return (
    <>
      {/* Stat strip */}
      <StatStrip>
        <WeightStatCard
          latestWeight={weightTrend?.latest ?? null}
          weightDelta={weightTrend?.change ?? null}
          entries={recentWeightEntries}
        />
        <StatCard
          label={t('today.training')}
          value={training?.session?.name ?? (waitingForTraining ? t('today.preparing') : t('today.restDay'))}
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
          headerIcon="🔥"
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
                  href(`/(client)/training/session/${training.session.sessionId}`),
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
            targets={nutritionTargets}
            meals={sortedMeals}
            eatenMealIds={eatenMealIds}
            eyebrow={t('today.nutritionEyebrow', { week: plan.weekNumber })}
            subline=""
            dayNote={plan.dayNote}
            onToggleEaten={handleToggleEaten}
            onMarkAllEaten={handleMarkAllEaten}
            isMarkAllLoading={markAllEatenMutation.isPending}
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

    </>
  )
}

export default HasTrainerState

const styles = StyleSheet.create({
  section: {
    marginTop: 24,
  },
})
