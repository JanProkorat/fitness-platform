import React, { useCallback, useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { useCompletionState } from '@/hooks/useCompletionState'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { href, hrefParams } from '@/lib/navigation'
import { StatStrip } from '@/components/ui/StatStrip'
import { StatCard } from '@/components/ui/StatCard'
import { WeightStatCard } from '@/components/today/WeightStatCard'
import { SectionHeader } from '@/components/ui/SectionHeader'
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
import { getTodaySession, type TodayTrainingResponse, type TrainingSession } from '@/api/training'
import {
  markExerciseComplete,
  markExerciseIncomplete,
  markSessionComplete,
  markSessionIncomplete,
  type MarkExerciseCompleteResponse,
  type MarkExerciseIncompleteResponse,
  type MarkSessionCompleteResponse,
  type MarkSessionIncompleteResponse,
} from '@/api/trainingCompletion'
import {
  getComplianceScore,
  getCollaborations,
  type ComplianceScoreResponse,
  type CollaborationDto,
} from '@/api/profile'
import { getMeasurementStats, getMeasurements, type MeasurementStatsResponse } from '@/api/measurements'
import { useTodayStore } from '@/stores/todayStore'
import { PlanBanner } from '@/components/today/PlanBanner'
import { ResumeTrainingBanner } from '@/components/training/ResumeTrainingBanner'
import { useLiveSessionStore } from '@/stores/liveSessionStore'
import { deriveSessionCtaState, type SessionCtaState } from '@/components/training/trainingCardHelpers'

// ─── NoDayNutritionCard ───────────────────────────────────────────────────────
// Shown when the user has an active nutrition plan but today is not covered by
// any published week. Prevents the "Waiting for plan" banner from appearing
// when the plan actually exists.

interface NoDayNutritionCardProps {
  planName?: string
}

function NoDayNutritionCard({ planName }: NoDayNutritionCardProps) {
  const colors = useTheme()
  const { t } = useTranslation()
  return (
    <>
      <SectionHeader title={t('today.todaysNutrition')} />
      <View style={[noDayCardStyles.card, { backgroundColor: colors.bg2, borderRadius: Radius.lg }]}>
        <Text style={[noDayCardStyles.title, { color: colors.label }]}>
          {t('today.noNutritionPlanForToday')}
        </Text>
        {planName ? (
          <Text style={[noDayCardStyles.sub, { color: colors.label2 }]}>
            {planName}
          </Text>
        ) : null}
      </View>
    </>
  )
}

const noDayCardStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  title: {
    ...Type.body,
    fontWeight: '600',
  },
  sub: {
    ...Type.caption1,
  },
})

// ─── applyExerciseProgressToCache ────────────────────────────────────────────
// Standalone helper (not a method) so it can be called from mutation onSuccess
// without `this` binding issues.

type CompletionResponseSource = 'exercise' | 'session'

function applyExerciseProgressToCache(
  queryClient: ReturnType<typeof useQueryClient>,
  sessionId: string,
  response:
    | MarkExerciseCompleteResponse
    | MarkExerciseIncompleteResponse
    | MarkSessionCompleteResponse
    | MarkSessionIncompleteResponse,
  source: CompletionResponseSource,
  allExerciseIds: string[],
): void {
  queryClient.setQueryData<TodayTrainingResponse>(['today-training'], (prev) => {
    if (!prev) return prev

    const isSessionComplete =
      source === 'exercise'
        ? (response as MarkExerciseCompleteResponse).sessionComplete ?? false
        : (response.completedExerciseCount ?? 0) >= (response.totalExerciseCount ?? 1)

    const prevIds: string[] =
      (prev.completedExerciseIdsBySession ?? {})[sessionId] ?? []

    let newIds: string[]
    if (isSessionComplete) {
      newIds = allExerciseIds
    } else {
      // Per-exercise toggle: keep optimistic ids (already updated in onMutate).
      newIds = prevIds
    }

    const prevVersion = (prev.versionBySession ?? {})[sessionId] ?? 1

    return {
      ...prev,
      completedExerciseIdsBySession: {
        ...(prev.completedExerciseIdsBySession ?? {}),
        [sessionId]: newIds,
      },
      versionBySession: {
        ...(prev.versionBySession ?? {}),
        [sessionId]: response.version ?? prevVersion,
      },
    }
  })
}

// ─── Component ──────────────────────────────────────────────────────

export function HasTrainerState() {
  const colors = useTheme()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  // ── Pending plans (additive banners) ──
  const pendingPlans = useTodayStore((s) => s.pendingPlans)

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

  // The today sessions array — primary data source for the new card.
  const todaySessions: TrainingSession[] = training?.sessions ?? []

  // Weight trend: latest weight + difference against the previous measurement
  const weightTrend = useMemo(() => {
    const stats = statsQuery.data
    if (!stats?.latestWeight) return null

    const weights = (recentMeasurementsQuery.data?.items ?? [])
      .filter((m): m is typeof m & { weightKg: number; measuredAt: string } =>
        m.weightKg != null && m.measuredAt != null,
      )
      .map((m) => ({ date: m.measuredAt, weight: m.weightKg }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const change =
      weights.length >= 2
        ? weights[weights.length - 1].weight - weights[weights.length - 2].weight
        : null

    return { latest: stats.latestWeight, change }
  }, [statsQuery.data, recentMeasurementsQuery.data])

  // Generated GetTodayLogResponse makes totalConsumed optional; normalise here.
  const consumed = {
    kcal: log?.totalConsumed?.kcal ?? 0,
    protein: log?.totalConsumed?.protein ?? 0,
    carbs: log?.totalConsumed?.carbs ?? 0,
    fat: log?.totalConsumed?.fat ?? 0,
    fiber: log?.totalConsumed?.fiber ?? 0,
  }
  const settings = plan?.globalSettings
  const dayTotals = plan?.dayTotals
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

  // ── Pending-plan flags ──
  const hasPendingTraining = pendingPlans.some((p) => p.type === 'training')
  const hasPendingNutrition = pendingPlans.some((p) => p.type === 'nutrition')

  // ── Waiting-for-plan logic ──
  const collabs = useMemo(() => collabQuery.data ?? [], [collabQuery.data])

  // True when the user has an active nutrition plan but no day is published for today.
  // Distinguishes "plan exists but today is unpublished" from "no plan at all".
  const hasActivePlanButNoDayToday = useMemo(
    () => !!(fullPlanQuery.data?.planId && !plan),
    [fullPlanQuery.data?.planId, plan],
  )

  const { waitingForTraining, waitingForNutrition, isWaitingForAnyPlan } = useMemo(() => {
    const hasTrainerLink = collabs.some((c) => c.role === 'Trainer')
    const hasNutritionistLink = collabs.some((c) => c.role === 'Nutritionist')
    const wTraining = !training?.hasSession && hasTrainerLink && !hasPendingTraining
    // Only show "waiting for nutrition plan" when the user truly has NO plan assigned.
    // If they have a plan but today is not covered, we show a different card instead.
    const wNutrition = !plan && !hasActivePlanButNoDayToday && hasNutritionistLink && !hasPendingNutrition
    return { waitingForTraining: wTraining, waitingForNutrition: wNutrition, isWaitingForAnyPlan: wTraining || wNutrition }
  }, [collabs, training?.hasSession, plan, hasActivePlanButNoDayToday, hasPendingTraining, hasPendingNutrition])

  // ── Next-week shopping prep banner ──
  const showShoppingBanner = useMemo(() => {
    const fp = fullPlanQuery.data
    if (!fp?.currentWeek || !fp.currentDayOfWeek) return null
    if (fp.currentDayOfWeek < 5) return null
    const nextWeek = fp.currentWeek + 1
    if (nextWeek > (fp.publishedWeekCount ?? 0)) return null
    return nextWeek
  }, [fullPlanQuery.data])

  const eatenMealIds = useMemo(() => {
    const set = new Set<string>()
    logQuery.data?.mealsEaten?.forEach((m) => { if (m.mealId) set.add(m.mealId) })
    return set
  }, [logQuery.data])

  const sortedMeals = useMemo(
    () => [...(plan?.meals ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [plan?.meals],
  )

  // ── Client-side completion state (multi-session) ──────────────────────────
  const {
    completedIdsBySession,
    sessionCompleteMap,
    completedIdsFor,
    aggregateDone,
    aggregateTotal,
  } = useCompletionState(trainingQuery.data)

  // ── Mutation: toggle a single exercise complete/incomplete ─────────────────
  const toggleExerciseMutation = useMutation({
    mutationFn: async ({
      sessionId,
      exerciseExternalId,
      complete,
    }: {
      sessionId: string
      exerciseExternalId: string
      complete: boolean
    }) => {
      const cache = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])
      const version = (cache?.versionBySession ?? {})[sessionId]
      const req = { version }
      if (complete) {
        return markExerciseComplete(sessionId, exerciseExternalId, req)
      } else {
        return markExerciseIncomplete(sessionId, exerciseExternalId, req)
      }
    },
    onMutate: async ({ sessionId, exerciseExternalId, complete }) => {
      await queryClient.cancelQueries({ queryKey: ['today-training'] })
      const previous = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])
      if (previous) {
        const prevIds: string[] = (previous.completedExerciseIdsBySession ?? {})[sessionId] ?? []
        const nextIdsSet = new Set(prevIds)
        if (complete) {
          nextIdsSet.add(exerciseExternalId)
        } else {
          nextIdsSet.delete(exerciseExternalId)
        }
        const nextIds = Array.from(nextIdsSet)
        // NOTE: do NOT bump versionBySession here. `mutationFn` reads the
        // version from the cache after `onMutate` runs and sends it as the
        // optimistic-concurrency token; bumping it would send the wrong
        // value and cause a 409 on the server.
        //
        // When marking an exercise complete, write the planned set numbers so
        // the per-set ✓ column fills immediately. The subsequent refetch
        // reconciles with the backend's derivation.
        // When unmarking, clear that exercise's set-level entries so the
        // per-set ✓ column clears immediately (no visible flicker).
        const session = (previous.sessions ?? []).find((s) => s.sessionId === sessionId)
        const plannedEx = session?.exercises?.find((e) => e.exerciseExternalId === exerciseExternalId)
        const plannedSetNumbers = (plannedEx?.sets ?? [])
          .map((s) => s.setNumber)
          .filter((n): n is number => n != null)
          .sort((a, b) => a - b)
        const prevSessionSetsMap: Record<string, number[]> =
          previous.completedSetsBySessionExercise?.[sessionId] ?? {}
        const nextSetsForSession: Record<string, number[]> = complete
          ? { ...prevSessionSetsMap, [exerciseExternalId]: plannedSetNumbers }
          : (({ [exerciseExternalId]: _omitted, ...rest }) => rest)(prevSessionSetsMap)

        queryClient.setQueryData<TodayTrainingResponse>(['today-training'], {
          ...previous,
          completedExerciseIdsBySession: {
            ...(previous.completedExerciseIdsBySession ?? {}),
            [sessionId]: nextIds,
          },
          completedSetsBySessionExercise: {
            ...(previous.completedSetsBySessionExercise ?? {}),
            [sessionId]: nextSetsForSession,
          },
        })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['today-training'], context.previous)
      }
      queryClient.invalidateQueries({ queryKey: ['today-training'] })
    },
    onSuccess: (response, { sessionId }) => {
      const cache = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])
      const session = (cache?.sessions ?? []).find((s) => s.sessionId === sessionId)
      const allExIds = (session?.exercises ?? [])
        .map((e) => e.exerciseExternalId)
        .filter((id): id is string => id != null)
      applyExerciseProgressToCache(queryClient, sessionId, response, 'exercise', allExIds)
      queryClient.invalidateQueries({ queryKey: ['compliance-score'] })
    },
  })

  // ── Mutation: toggle the entire session complete/incomplete ───────────────
  const toggleSessionMutation = useMutation({
    mutationFn: async ({ sessionId, complete }: { sessionId: string; complete: boolean }) => {
      const cache = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])
      const version = (cache?.versionBySession ?? {})[sessionId]
      const req = { version }
      if (complete) {
        return markSessionComplete(sessionId, req)
      } else {
        return markSessionIncomplete(sessionId, req)
      }
    },
    onMutate: async ({ sessionId, complete }) => {
      await queryClient.cancelQueries({ queryKey: ['today-training'] })
      const previous = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])
      if (previous) {
        const session = (previous.sessions ?? []).find((s) => s.sessionId === sessionId)
        const allExIds = (session?.exercises ?? [])
          .map((e) => e.exerciseExternalId)
          .filter((id): id is string => id != null)
        // NOTE: do NOT bump versionBySession here (see toggleExerciseMutation
        // for the full rationale).
        //
        // When marking a session complete, build a planned-sets sub-map for
        // every trackable exercise so the per-set ✓ column fills immediately.
        // The subsequent refetch reconciles with the backend's derivation.
        // When unmarking, clear every exercise's set-level entries for this
        // session so the per-set ✓ column clears immediately.
        const plannedSetsByEx: Record<string, number[]> = {}
        for (const ex of session?.exercises ?? []) {
          const exId = ex.exerciseExternalId
          if (!exId) continue
          const nums = (ex.sets ?? [])
            .map((s) => s.setNumber)
            .filter((n): n is number => n != null)
            .sort((a, b) => a - b)
          if (nums.length > 0) plannedSetsByEx[exId] = nums
        }
        const nextSetsForSession: Record<string, Record<string, number[]>> = complete
          ? {
              ...(previous.completedSetsBySessionExercise ?? {}),
              [sessionId]: plannedSetsByEx,
            }
          : {
              ...(previous.completedSetsBySessionExercise ?? {}),
              [sessionId]: {},
            }

        queryClient.setQueryData<TodayTrainingResponse>(['today-training'], {
          ...previous,
          completedExerciseIdsBySession: {
            ...(previous.completedExerciseIdsBySession ?? {}),
            [sessionId]: complete ? allExIds : [],
          },
          completedSetsBySessionExercise: nextSetsForSession,
        })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['today-training'], context.previous)
      }
      queryClient.invalidateQueries({ queryKey: ['today-training'] })
    },
    onSuccess: (response, { sessionId }) => {
      const cache = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])
      const session = (cache?.sessions ?? []).find((s) => s.sessionId === sessionId)
      const allExIds = (session?.exercises ?? [])
        .map((e) => e.exerciseExternalId)
        .filter((id): id is string => id != null)
      applyExerciseProgressToCache(queryClient, sessionId, response, 'session', allExIds)
      queryClient.invalidateQueries({ queryKey: ['compliance-score'] })
    },
  })

  // ── Live session store ──────────────────────────────────────────────────────
  const liveSessionStore = useLiveSessionStore()
  const hasActiveSession = liveSessionStore.hasActiveSession()
  const activeLogId = liveSessionStore.activeLogId

  // ── Per-session CTA handler ───────────────────────────────────────────────
  // Starts OR resumes a live training session. We don't create the workout log
  // here — the log screen at `/log/new?planId=&sessionId=` shows the pre-start
  // intro (per the prototype) and calls `startWorkout` itself once the user
  // taps the Start button. This preserves the intro step that gets skipped
  // when we create the log up-front on this screen.
  const handleSessionCta = useCallback(
    (session: TrainingSession, state: SessionCtaState) => {
      const sessionId = session.sessionId
      const planId = training?.planId

      if (!sessionId || !planId) return
      if (state === 'finished') return

      // Resume an in-flight log if one is already running locally.
      if (activeLogId) {
        router.push(href(`/(client)/training-session/${activeLogId}`))
        return
      }

      // Fresh start — navigate to the pre-start intro.
      router.push(
        hrefParams('/(client)/training-session/[id]', {
          id: 'new',
          planId,
          sessionId,
        }),
      )
    },
    [training?.planId, activeLogId, router],
  )

  // ── Per-session CTA state map ─────────────────────────────────────────────
  const liveSessionId = liveSessionStore.sessionId
  const sessionCtaStateBySession = useMemo<Record<string, SessionCtaState>>(() => {
    const result: Record<string, SessionCtaState> = {}
    for (const session of todaySessions) {
      if (!session.sessionId) continue
      const completedIds = completedIdsFor(session.sessionId)
      // When a live session is in-flight for this session (sets done but no
      // full exercise ticked yet), bump not-started → in-progress so the CTA
      // reads "Continue training" rather than "Start training".
      const isLiveForThisSession =
        hasActiveSession && session.sessionId === liveSessionId
      result[session.sessionId] = deriveSessionCtaState(
        session,
        completedIds,
        isLiveForThisSession,
      )
    }
    return result
  }, [todaySessions, completedIdsFor, hasActiveSession, liveSessionId])

  const handleToggleExercise = useCallback(
    (sessionId: string, exerciseExternalId: string) => {
      const ids = completedIdsFor(sessionId)
      const complete = !ids.has(exerciseExternalId)
      toggleExerciseMutation.mutate({ sessionId, exerciseExternalId, complete })
    },
    [toggleExerciseMutation, completedIdsFor],
  )

  const handleToggleSession = useCallback(
    (sessionId: string) => {
      const isComplete = sessionCompleteMap[sessionId] ?? false
      toggleSessionMutation.mutate({ sessionId, complete: !isComplete })
    },
    [toggleSessionMutation, sessionCompleteMap],
  )

  // ── Training card subtitle ──
  const trainingPlanSubtitle = useMemo(() => {
    const parts: string[] = []
    if (training?.planName) parts.push(training.planName)
    if (training?.currentWeek) parts.push(t('today.weekNumber', { week: training.currentWeek }))
    return parts.join(' \u00b7 ')
  }, [training, t])

  // ── Stat card: weekly compliance ──────────────────────────────────────────
  // Backend default window for GET /client/progress/compliance is the last 7
  // days; the response's `compliancePercent` is the combined nutrition+training
  // compliance. Pairs with the streak card on the right (streak = days in a
  // row, compliance = "how close to plan this week").
  const compliancePercent = Math.round(streakQuery.data?.compliancePercent ?? 0)
  const complianceColor =
    compliancePercent >= 80
      ? colors.green
      : compliancePercent >= 50
        ? colors.gold
        : colors.orange

  // ── Mutation: toggle meal eaten/uneaten ──
  const toggleEatenMutation = useMutation({
    mutationFn: async ({ mealId, eaten }: { mealId: string; eaten: boolean }) => {
      if (eaten) await logMealEaten(mealId)
      else await unlogMealEaten(mealId)
    },
    onMutate: async ({ mealId, eaten }) => {
      await queryClient.cancelQueries({ queryKey: ['today-log'] })
      const previous = queryClient.getQueryData<TodayLogResponse>(['today-log'])
      if (previous) {
        const prevMealsEaten = previous.mealsEaten ?? []
        const prevConsumed = {
          kcal: previous.totalConsumed?.kcal ?? 0,
          protein: previous.totalConsumed?.protein ?? 0,
          carbs: previous.totalConsumed?.carbs ?? 0,
          fat: previous.totalConsumed?.fat ?? 0,
          fiber: previous.totalConsumed?.fiber ?? 0,
        }
        const meal = plan?.meals?.find((m) => m.mealId === mealId)
        const totals = meal?.mealTotals
          ? {
              kcal: meal.mealTotals.kcal ?? 0,
              protein: meal.mealTotals.protein ?? 0,
              carbs: meal.mealTotals.carbs ?? 0,
              fat: meal.mealTotals.fat ?? 0,
              fiber: meal.mealTotals.fiber ?? 0,
            }
          : { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
        if (eaten) {
          queryClient.setQueryData<TodayLogResponse>(['today-log'], {
            ...previous,
            mealsEaten: [
              ...prevMealsEaten,
              { mealId, mealName: meal?.kind ?? '', eatenAt: new Date().toISOString(), totals },
            ],
            totalConsumed: {
              kcal: prevConsumed.kcal + totals.kcal,
              protein: prevConsumed.protein + totals.protein,
              carbs: prevConsumed.carbs + totals.carbs,
              fat: prevConsumed.fat + totals.fat,
              fiber: prevConsumed.fiber + totals.fiber,
            },
          })
        } else {
          const removed = prevMealsEaten.filter((m) => m.mealId === mealId)
          const kept = prevMealsEaten.filter((m) => m.mealId !== mealId)
          const removedTotals = removed.reduce(
            (sum, m) => ({
              kcal: sum.kcal + (m.totals?.kcal ?? 0),
              protein: sum.protein + (m.totals?.protein ?? 0),
              carbs: sum.carbs + (m.totals?.carbs ?? 0),
              fat: sum.fat + (m.totals?.fat ?? 0),
              fiber: sum.fiber + (m.totals?.fiber ?? 0),
            }),
            { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
          )
          const clamp = (n: number): number => (n > 0 ? n : 0)
          queryClient.setQueryData<TodayLogResponse>(['today-log'], {
            ...previous,
            mealsEaten: kept,
            totalConsumed: {
              kcal: clamp(prevConsumed.kcal - removedTotals.kcal),
              protein: clamp(prevConsumed.protein - removedTotals.protein),
              carbs: clamp(prevConsumed.carbs - removedTotals.carbs),
              fat: clamp(prevConsumed.fat - removedTotals.fat),
              fiber: clamp(prevConsumed.fiber - removedTotals.fiber),
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
      queryClient.invalidateQueries({ queryKey: ['today-log'] })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-score'] })
    },
  })

  const handleToggleEaten = useCallback(
    (mealId: string) => {
      const currentlyEaten = eatenMealIds.has(mealId)
      toggleEatenMutation.mutate({ mealId, eaten: !currentlyEaten })
    },
    [toggleEatenMutation, eatenMealIds],
  )

  // ── Mutation: mark all remaining meals eaten (fan-out) ──
  const markAllEatenMutation = useMutation({
    mutationFn: async (mealIds: string[]) => {
      await Promise.all(mealIds.map((id) => logMealEaten(id)))
    },
    onMutate: async (mealIds: string[]) => {
      await queryClient.cancelQueries({ queryKey: ['today-log'] })
      const previous = queryClient.getQueryData<TodayLogResponse>(['today-log'])
      if (previous && plan) {
        const now = new Date().toISOString()
        const prevMealsEaten = previous.mealsEaten ?? []
        const prevConsumed = {
          kcal: previous.totalConsumed?.kcal ?? 0,
          protein: previous.totalConsumed?.protein ?? 0,
          carbs: previous.totalConsumed?.carbs ?? 0,
          fat: previous.totalConsumed?.fat ?? 0,
          fiber: previous.totalConsumed?.fiber ?? 0,
        }
        const newEntries = mealIds
          .map((id) => {
            const meal = (plan.meals ?? []).find((m) => m.mealId === id)
            const totals = meal?.mealTotals
              ? {
                  kcal: meal.mealTotals.kcal ?? 0,
                  protein: meal.mealTotals.protein ?? 0,
                  carbs: meal.mealTotals.carbs ?? 0,
                  fat: meal.mealTotals.fat ?? 0,
                  fiber: meal.mealTotals.fiber ?? 0,
                }
              : { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
            return { mealId: id, mealName: meal?.kind ?? '', eatenAt: now, totals }
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
          mealsEaten: [...prevMealsEaten, ...newEntries],
          totalConsumed: {
            kcal: prevConsumed.kcal + addedTotals.kcal,
            protein: prevConsumed.protein + addedTotals.protein,
            carbs: prevConsumed.carbs + addedTotals.carbs,
            fat: prevConsumed.fat + addedTotals.fat,
            fiber: prevConsumed.fiber + addedTotals.fiber,
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
    const remaining = (plan.meals ?? [])
      .map((m) => m.mealId)
      .filter((id): id is string => id != null && !eatenMealIds.has(id))
    if (remaining.length === 0) return
    markAllEatenMutation.mutate(remaining)
  }, [plan, eatenMealIds, markAllEatenMutation])

  // ── Live session resume banner ──
  const liveExIdx = liveSessionStore.currentExerciseIdx
  const liveSetIdx = liveSessionStore.currentSetIdx

  // Use the first session's exercises for the resume banner name.
  const liveExerciseName = useMemo(() => {
    const exercises = todaySessions[0]?.exercises ?? []
    return exercises[liveExIdx]?.exerciseName ?? ''
  }, [todaySessions, liveExIdx])

  const handleResume = useCallback(() => {
    if (activeLogId) {
      router.push(href(`/(client)/training-session/${activeLogId}`))
    }
  }, [router, activeLogId])

  // ── Render ──
  return (
    <>
      {/* Stat strip */}
      <StatStrip>
        <WeightStatCard
          latestWeight={weightTrend?.latest ?? null}
          weightDelta={weightTrend?.change ?? null}
        />
        <StatCard
          label={t('today.compliance')}
          value={`${compliancePercent}%`}
          sub={t('today.complianceSub')}
          color={complianceColor}
          progress={compliancePercent / 100}
          progressColor={complianceColor}
        />
        <StatCard
          label={t('today.streak')}
          value={streak}
          sub={t('today.daysInRow')}
          color={colors.orange}
          headerIcon="🔥"
        />
      </StatStrip>

      {/* Resume training banner — below stat strip, above pending plan banners */}
      {hasActiveSession && liveExerciseName ? (
        <ResumeTrainingBanner
          exerciseName={liveExerciseName}
          setNumber={liveSetIdx + 1}
          onResume={handleResume}
        />
      ) : null}

      {/* Pending plan banners — shown below the stat strip */}
      {pendingPlans.length > 0 && (
        <View style={styles.pendingBanners}>
          {pendingPlans.map((p) => (
            <PlanBanner key={p.planId} plan={p} />
          ))}
        </View>
      )}

      {/* Today's training */}
      {training?.hasSession && todaySessions.length > 0 && (
        <View style={styles.section}>
          <SectionHeader
            title={t('today.todaysTraining')}
            actionLabel={training.planId ? t('today.sectionActionDetail') : undefined}
            onActionPress={
              training.planId
                ? () => {
                    router.push(
                      hrefParams('/(client)/(tabs)/plans/[planId]', {
                        planId: training.planId!,
                        type: 'training',
                      }),
                    )
                  }
                : undefined
            }
          />
          <TrainingCard
            planName={trainingPlanSubtitle || t('today.trainingPlan')}
            sessions={todaySessions}
            completedIdsBySession={completedIdsBySession}
            sessionCompleteMap={sessionCompleteMap}
            onToggleExercise={handleToggleExercise}
            onToggleSession={handleToggleSession}
            sessionCtaStateBySession={sessionCtaStateBySession}
            onSessionCta={handleSessionCta}
            exerciseMuscleGroups={training?.exerciseMuscleGroups ?? {}}
            completedSetsBySessionExercise={trainingQuery.data?.completedSetsBySessionExercise ?? {}}
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

      {/* "No nutrition for today" — plan exists but today is not covered by a published week */}
      {hasActivePlanButNoDayToday && (
        <View style={styles.section}>
          <NoDayNutritionCard planName={fullPlanQuery.data?.planName} />
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
  pendingBanners: {
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 12,
    marginBottom: -12,
  },
  section: {
    marginTop: 24,
  },
})
