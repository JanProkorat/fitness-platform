import React, { useCallback, useMemo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { useCompletionState } from '@/hooks/useCompletionState'
import { Type } from '@/constants/typography'
import { goldAlpha } from '@/constants/colors'
import { href, hrefParams } from '@/lib/navigation'
import { StatStrip } from '@/components/ui/StatStrip'
import { StatCard } from '@/components/ui/StatCard'
import { WeightStatCard } from '@/components/today/WeightStatCard'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { TrainingCard } from '@/components/training/TrainingCard'
import { NutritionCard } from '@/components/nutrition/NutritionCard'
import { WaitingForPlanCard } from '@/components/today/WaitingForPlanCard'
import { HydrationStatCard } from '@/components/today/HydrationStatCard'
import { useHydrationStore } from '@/stores/hydrationStore'
import { ShoppingPrepBanner } from '@/components/today/ShoppingPrepBanner'
import { NoDayNutritionCard, NoDayTrainingCard } from '@/components/today/NoDayCards'
import { useTodayTrainingActions } from '@/components/today/useTodayTrainingActions'
import { useTodayNutritionActions } from '@/components/today/useTodayNutritionActions'
import {
  getTodayPlan,
  getTodayLog,
  getFullPlan,
  type TodayPlanResponse,
  type TodayLogResponse,
  type FullPlanResponse,
} from '@/api/nutrition'
import { getTodaySession, type TodayTrainingResponse, type TrainingSession } from '@/api/training'
// NOTE: TodayTrainingResponse is augmented in training.ts to include lockStateBySession.
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
import { deriveSessionCtaState, computeLockedSessionIds, type SessionCtaState } from '@/components/training/trainingCardHelpers'
import { getOrderedSessionItems } from '@/components/training/trainingCardFormat'

// ─── Component ──────────────────────────────────────────────────────

interface HasTrainerStateProps {
  /** Optional banner element rendered between the stat strip and the rest of the page. */
  topBanner?: React.ReactNode
}

export function HasTrainerState({ topBanner }: HasTrainerStateProps = {}) {
  const colors = useTheme()
  const router = useRouter()
  const { t } = useTranslation()

  // ── Hydration: read enabled flag to gate the home card ──
  const hydrationEnabled = useHydrationStore((s) => s.enabled)

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
    // Canonical key — shared with useTodayState / nutrition & plans tabs so
    // publish/update SignalR invalidations refresh every screen at once (#603).
    queryKey: ['nutrition-plan-full'],
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

    const periodDays =
      weights.length >= 2
        ? Math.round(
            (new Date(weights[weights.length - 1].date).getTime() -
              new Date(weights[weights.length - 2].date).getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : null

    return { latest: stats.latestWeight, change, periodDays }
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

  // True when the user has an active training plan but today has no session
  // (rest day, week-cycle gap, or every published week sits in the past on a
  // not-yet-completed plan — the backend filters Active-only, so a non-null
  // planId implies the plan is still Active). Distinguishes "plan exists but
  // today is empty" from "no plan at all".
  const hasActivePlanButNoTrainingToday = useMemo(
    () => !!(training?.planId && !training.hasSession),
    [training?.planId, training?.hasSession],
  )

  const { waitingForTraining, waitingForNutrition, isWaitingForAnyPlan } = useMemo(() => {
    const hasTrainerLink = collabs.some((c) => c.role === 'Trainer')
    const hasNutritionistLink = collabs.some((c) => c.role === 'Nutritionist')
    // Only show "waiting for training plan" when the user truly has NO active
    // training plan assigned. If a plan exists but today has no session, we
    // show NoDayTrainingCard instead — the plan isn't being prepared, today
    // just doesn't have one.
    const wTraining = !training?.planId && hasTrainerLink && !hasPendingTraining
    // Only show "waiting for nutrition plan" when the user truly has NO plan assigned.
    // If they have a plan but today is not covered, we show a different card instead.
    const wNutrition = !plan && !hasActivePlanButNoDayToday && hasNutritionistLink && !hasPendingNutrition
    return { waitingForTraining: wTraining, waitingForNutrition: wNutrition, isWaitingForAnyPlan: wTraining || wNutrition }
  }, [collabs, training?.planId, plan, hasActivePlanButNoDayToday, hasPendingTraining, hasPendingNutrition])

  // ── Next-week shopping prep banner ──
  const showShoppingBanner = useMemo(() => {
    const fp = fullPlanQuery.data
    if (!fp?.currentWeek || !fp.currentDayOfWeek) return null
    if (fp.currentDayOfWeek < 5) return null
    const nextWeek = fp.currentWeek + 1
    if (nextWeek > (fp.publishedWeekCount ?? 0)) return null
    return nextWeek
  }, [fullPlanQuery.data])

  /** Meal IDs that have been confirmed as eaten (eatenAt is non-null). */
  const eatenMealIds = useMemo(() => {
    const set = new Set<string>()
    logQuery.data?.mealsEaten?.forEach((m) => {
      if (m.mealId && m.eatenAt != null) set.add(m.mealId)
    })
    return set
  }, [logQuery.data])

  /** Meal IDs that have at least one diary photo attached (regardless of eaten state). */
  const eatenMealIdsWithPhotos = useMemo(() => {
    const set = new Set<string>()
    logQuery.data?.mealsEaten?.forEach((m) => {
      if (m.mealId && (m.photos?.length ?? 0) > 0) set.add(m.mealId)
    })
    return set
  }, [logQuery.data])

  /** Per-meal diary photos from the log, keyed by mealId. Includes per-photo captions. */
  const mealPhotosByMealId = useMemo(() => {
    const map: Record<string, { blobUrl: string; note?: string | null; uploadedAt?: string }[]> = {}
    logQuery.data?.mealsEaten?.forEach((m) => {
      if (m.mealId && m.photos && m.photos.length > 0) {
        map[m.mealId] = m.photos
          .filter((p) => typeof p.blobUrl === 'string')
          .map((p) => ({ blobUrl: p.blobUrl as string, note: p.note ?? null, uploadedAt: p.uploadedAt }))
      }
    })
    return map
  }, [logQuery.data])

  /** Meal-level diary notes from the log, keyed by mealId. Used by lightbox top overlay. */
  const mealNoteByMealId = useMemo(() => {
    const map: Record<string, string | null> = {}
    logQuery.data?.mealsEaten?.forEach((m) => {
      if (m.mealId) {
        map[m.mealId] = m.note ?? null
      }
    })
    return map
  }, [logQuery.data])

  /**
   * Per-session diary photos from today's session logs, keyed by sessionId.
   * Sourced from `photosBySession` in TodayTrainingResponse (#405).
   * Mirrors how `mealPhotosByMealId` is derived from `mealsEaten[].photos`.
   */
  const photosBySession = useMemo(() => {
    return trainingQuery.data?.photosBySession ?? {}
  }, [trainingQuery.data?.photosBySession])

  const sortedMeals = useMemo(
    () => [...(plan?.meals ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [plan?.meals],
  )

  // ── Client-side completion state (multi-session) ──────────────────────────
  const {
    completedIdsBySectionAndSession,
    completedIdsBySession,
    completedSectionIdsBySession,
    sessionCompleteMap,
    completedIdsForSection,
    completedIdsFor,
    completedSectionIdsFor,
    aggregateDone,
    aggregateTotal,
  } = useCompletionState(trainingQuery.data)

  const {
    handleToggleExercise,
    handleToggleExercises,
    handleToggleSection,
    handleToggleSession,
    handleMarkAllTrainingDone,
    isMarkAllTrainingLoading,
  } = useTodayTrainingActions({
    completedIdsForSection,
    completedSectionIdsFor,
    sessionCompleteMap,
    todaySessions,
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
      // Per-section completion map for this session (sectionId → completed exId set).
      // Using the section-keyed map rather than the flat union prevents a catalog
      // exercise that appears in both W1 and W3 from satisfying W3's completion
      // check just because the user marked it in W1.
      const sectionMap =
        completedIdsBySectionAndSession.get(session.sessionId) ??
        new Map<string, ReadonlySet<string>>()
      const sectionIds = completedSectionIdsFor(session.sessionId)
      // When a live session is in-flight for this session (sets done but no
      // full exercise ticked yet), bump not-started → in-progress so the CTA
      // reads "Continue training" rather than "Start training".
      const isLiveForThisSession =
        hasActiveSession && session.sessionId === liveSessionId
      result[session.sessionId] = deriveSessionCtaState(
        session,
        sectionMap,
        sectionIds,
        isLiveForThisSession,
      )
    }
    return result
  }, [todaySessions, completedIdsBySectionAndSession, completedSectionIdsFor, hasActiveSession, liveSessionId])

  // ── Locked sibling session IDs ────────────────────────────────────────────
  // When a live session is running, every OTHER session for today shows a
  // locked CTA ("Session already in progress") to prevent accidental parallel starts.
  const lockedSessionIds = useMemo(
    () => computeLockedSessionIds(todaySessions, hasActiveSession, liveSessionId),
    [todaySessions, hasActiveSession, liveSessionId],
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

  const {
    handleToggleEaten,
    handleMarkAllEaten,
    isMarkAllLoading,
  } = useTodayNutritionActions({ plan, eatenMealIds })

  /** Navigate to the plan-photos gallery screen (nutrition plan). */
  const handlePhotoGridPress = useCallback(() => {
    if (!plan?.planId) return
    router.push(hrefParams('/(client)/plan-photos', { planId: plan.planId, planType: 'nutrition' }))
  }, [router, plan?.planId])

  /** Navigate to the training plan-photos gallery screen (training plan). */
  const handleTrainingPhotoGridPress = useCallback(() => {
    if (!training?.planId) return
    router.push(hrefParams('/(client)/plan-photos', { planId: training.planId, planType: 'training' }))
  }, [router, training?.planId])

  /**
   * Navigate to the session-scoped photo upload screen from the session card camera button.
   * Receives the sessionId so the screen can call POST /client/training/log/sessions/{id}/photos.
   * Replaces the former plan-wide plan-photos-upload navigation (#405).
   */
  const handleSessionPhotoPress = useCallback(
    (sessionId: string) => {
      const session = todaySessions.find((s) => s.sessionId === sessionId)
      if (!session) return
      router.push(
        hrefParams('/(client)/session-log-photo', {
          sessionId,
          sessionName: session.name ?? '',
        }),
      )
    },
    [router, todaySessions],
  )

  /** Navigate to the meal-log-photo modal screen for the tapped meal. */
  const handlePhotoPress = useCallback(
    (mealId: string) => {
      const meal = (plan?.meals ?? []).find((m) => m.mealId === mealId)
      if (!meal) return
      const totalItems =
        (meal.foods?.length ?? 0) + (meal.recipes?.length ?? 0)
      router.push(
        hrefParams('/(client)/meal-log-photo', {
          mealId: meal.mealId ?? '',
          mealName: meal.kind ?? '',
          mealTime: meal.time ?? '',
          mealKcal: String(Math.round(meal.mealTotals?.kcal ?? 0)),
          mealItemsCount: String(totalItems),
        }),
      )
    },
    [plan, router],
  )

  // ── Live session resume banner ──
  const liveExIdx = liveSessionStore.currentExerciseIdx
  const liveSetIdx = liveSessionStore.currentSetIdx

  // Use the first session's exercises for the resume banner name. Exercises
  // are flattened from the same ordered workout+standalone interleave the
  // live training screen itself iterates over, so `liveExIdx` (an index into
  // that screen's flat exercise sequence) resolves to the same exercise here.
  const liveExerciseName = useMemo(() => {
    const firstSession = todaySessions[0]
    if (!firstSession) return ''
    const exercises = getOrderedSessionItems(firstSession).flatMap((item) => item.exercises)
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
          periodDays={weightTrend?.periodDays ?? null}
        />
        {hydrationEnabled ? (
          <HydrationStatCard />
        ) : (
          <StatCard
            label={t('today.compliance')}
            value={`${compliancePercent}%`}
            sub={t('today.complianceSub')}
            color={complianceColor}
            progress={compliancePercent / 100}
            progressColor={complianceColor}
          />
        )}
        <StatCard
          label={t('today.streak')}
          value={streak}
          sub={t('today.daysInRow')}
          color={colors.orange}
          headerIcon="🔥"
        />
      </StatStrip>

      {/* Optional top banner (e.g. pending questionnaires) — sits directly under the stat strip */}
      {topBanner}

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

      {/* Next-week shopping prep banner — top-of-page banner under the stat
          strip / pending banners, ahead of any plan cards below.
          `marginBottom: -8` pulls the next section up so the gap between the
          banner and the first plan card reads ~8 px instead of the full 16 px
          rhythm used between regular sections. */}
      {showShoppingBanner !== null && (
        <View style={[styles.section, { marginBottom: -8 }]}>
          <ShoppingPrepBanner week={showShoppingBanner} />
        </View>
      )}

      {/* Training + nutrition slots.
          Default order is training → nutrition. Swapped when today has a
          nutrition plan but no training session, so the "no training for
          today" placeholder sits below the actual nutrition card instead of
          above it. The mirrored case (training today, no nutrition today)
          already lands correctly in the default order. */}
      {(() => {
        const hasTrainingToday = !!training?.hasSession && todaySessions.length > 0
        const hasNutritionToday = !!plan
        const trainingSlot = hasTrainingToday ? (
          <View style={[styles.section, { marginBottom: -8 }]} key="training">
            <SectionHeader
              title={t('today.todaysTraining')}
              action={
                <View style={styles.trainingHeaderActions}>
                  {training?.planId ? (
                    <Pressable
                      onPress={handleTrainingPhotoGridPress}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('training.photoCta')}
                      style={styles.photoCtaBtn}
                    >
                      <View
                        style={[
                          styles.photoCtaIconChip,
                          { backgroundColor: goldAlpha['12'], borderColor: goldAlpha['35'] },
                        ]}
                      >
                        <Ionicons name="camera" size={13} color={colors.onGoldChip} />
                      </View>
                      <Text style={[styles.photoCtaLabel, { color: colors.gold }]}>
                        {t('training.photoCta')}
                      </Text>
                    </Pressable>
                  ) : null}
                  {training?.planId ? (
                    <Pressable
                      onPress={() => {
                        router.push(
                          hrefParams('/(client)/plan/[planId]', {
                            planId: training.planId!,
                            type: 'training',
                          }),
                        )
                      }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('today.sectionActionDetail')}
                      style={styles.photoCtaBtn}
                    >
                      <View
                        style={[
                          styles.photoCtaIconChip,
                          { backgroundColor: goldAlpha['12'], borderColor: goldAlpha['35'] },
                        ]}
                      >
                        <Ionicons name="chevron-forward" size={13} color={colors.onGoldChip} />
                      </View>
                      <Text style={[styles.photoCtaLabel, { color: colors.gold }]}>
                        {t('today.sectionActionDetail')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              }
            />
            <TrainingCard
              planName={trainingPlanSubtitle || t('today.trainingPlan')}
              sessions={todaySessions}
              completedIdsBySectionAndSession={completedIdsBySectionAndSession}
              completedIdsBySession={completedIdsBySession}
              completedSectionIdsBySession={completedSectionIdsBySession}
              sessionCompleteMap={sessionCompleteMap}
              onToggleExercise={handleToggleExercise}
              onToggleExercises={handleToggleExercises}
              onToggleSection={handleToggleSection}
              onToggleSession={handleToggleSession}
              sessionCtaStateBySession={sessionCtaStateBySession}
              onSessionCta={handleSessionCta}
              lockedSessionIds={lockedSessionIds}
              exerciseMuscleGroups={training?.exerciseMuscleGroups ?? {}}
              completedSetsBySessionExercise={trainingQuery.data?.completedSetsBySessionExercise ?? {}}
              lockStateBySession={trainingQuery.data?.lockStateBySession ?? {}}
              onMarkAllTrainingDone={handleMarkAllTrainingDone}
              isMarkAllTrainingLoading={isMarkAllTrainingLoading}
              onSessionPhotoPress={handleSessionPhotoPress}
              photosBySession={photosBySession}
              loggedSetsBySessionExercise={trainingQuery.data?.loggedSetsBySessionExercise}
              hasModificationsBySession={trainingQuery.data?.hasModificationsBySession}
              planId={training?.planId ?? undefined}
            />
          </View>
        ) : hasActivePlanButNoTrainingToday ? (
          <View style={styles.section} key="training">
            <NoDayTrainingCard planName={training?.planName} />
          </View>
        ) : null

        const nutritionSlot = hasNutritionToday ? (
          <View style={[styles.section, { marginBottom: -8 }]} key="nutrition">
            <SectionHeader
              title={t('today.todaysNutrition')}
              action={
                <View style={styles.nutritionHeaderActions}>
                  {plan?.planId ? (
                    <Pressable
                      onPress={handlePhotoGridPress}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('nutrition.photoCta')}
                      style={styles.photoCtaBtn}
                    >
                      <View
                        style={[
                          styles.photoCtaIconChip,
                          { backgroundColor: goldAlpha['12'], borderColor: goldAlpha['35'] },
                        ]}
                      >
                        <Ionicons name="camera" size={13} color={colors.onGoldChip} />
                      </View>
                      <Text style={[styles.photoCtaLabel, { color: colors.gold }]}>
                        {t('nutrition.photoCta')}
                      </Text>
                    </Pressable>
                  ) : null}
                  {plan?.planId ? (
                    <Pressable
                      onPress={() => {
                        router.push(
                          hrefParams('/(client)/plan/[planId]', {
                            planId: plan.planId!,
                            type: 'nutrition',
                          }),
                        )
                      }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('today.sectionActionDetail')}
                      style={styles.photoCtaBtn}
                    >
                      <View
                        style={[
                          styles.photoCtaIconChip,
                          { backgroundColor: goldAlpha['12'], borderColor: goldAlpha['35'] },
                        ]}
                      >
                        <Ionicons name="chevron-forward" size={13} color={colors.onGoldChip} />
                      </View>
                      <Text style={[styles.photoCtaLabel, { color: colors.gold }]}>
                        {t('today.sectionActionDetail')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              }
            />
            <NutritionCard
              consumed={consumed}
              targets={nutritionTargets}
              meals={sortedMeals}
              eatenMealIds={eatenMealIds}
              eatenMealIdsWithPhotos={eatenMealIdsWithPhotos}
              mealPhotosByMealId={mealPhotosByMealId}
              mealNoteByMealId={mealNoteByMealId}
              eyebrow={t('today.nutritionEyebrow', { week: plan!.weekNumber })}
              subline=""
              dayNote={plan!.dayNote}
              onToggleEaten={handleToggleEaten}
              onPhotoPress={handlePhotoPress}
              onMarkAllEaten={handleMarkAllEaten}
              isMarkAllLoading={isMarkAllLoading}
              planId={plan!.planId ?? undefined}
            />
          </View>
        ) : hasActivePlanButNoDayToday ? (
          <View style={styles.section} key="nutrition">
            <NoDayNutritionCard planName={fullPlanQuery.data?.planName} />
          </View>
        ) : null

        const nutritionFirst = hasNutritionToday && !hasTrainingToday
        return nutritionFirst
          ? <>{nutritionSlot}{trainingSlot}</>
          : <>{trainingSlot}{nutritionSlot}</>
      })()}

      {/* Waiting for plan card */}
      {isWaitingForAnyPlan && (
        <View style={styles.section}>
          <WaitingForPlanCard
            waitingForTraining={waitingForTraining}
            waitingForNutrition={waitingForNutrition}
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
    marginTop: 16,
  },
  nutritionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trainingHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mealsProgress: {
    ...Type.footnote,
  },
  photoCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  photoCtaIconChip: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCtaLabel: {
    ...Type.footnote,
    fontWeight: '600',
  },
})
