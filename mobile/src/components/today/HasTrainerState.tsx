import React, { useCallback, useMemo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { useCompletionState } from '@/hooks/useCompletionState'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { goldAlpha } from '@/constants/colors'
import { href, hrefParams } from '@/lib/navigation'
import { StatStrip } from '@/components/ui/StatStrip'
import { StatCard } from '@/components/ui/StatCard'
import { WeightStatCard } from '@/components/today/WeightStatCard'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { TrainingCard } from '@/components/training/TrainingCard'
import { NutritionCard } from '@/components/nutrition/NutritionCard'
import { WaitingForPlanCard } from '@/components/today/WaitingForPlanCard'
import { HydrationCard } from '@/components/hydration/HydrationCard'
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
// NOTE: TodayTrainingResponse is augmented in training.ts to include lockStateBySession.
import {
  markExerciseComplete,
  markExerciseIncomplete,
  markSectionComplete,
  markSectionIncomplete,
  markSessionComplete,
  markSessionIncomplete,
  markWholeDayComplete,
  type MarkExerciseCompleteResponse,
  type MarkExerciseIncompleteResponse,
  type MarkSectionCompleteResponse,
  type MarkSectionIncompleteResponse,
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
import { deriveSessionCtaState, computeLockedSessionIds, type SessionCtaState } from '@/components/training/trainingCardHelpers'

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

// ─── NoDayTrainingCard ────────────────────────────────────────────────────────
// Shown when the user has an active training plan but today has no session
// (rest day, week-cycle gap, or every published week is in the past on a
// not-yet-completed plan). Prevents the "waiting for training plan" banner
// from appearing when the plan actually exists.

interface NoDayTrainingCardProps {
  planName?: string
}

function NoDayTrainingCard({ planName }: NoDayTrainingCardProps) {
  const colors = useTheme()
  const { t } = useTranslation()
  return (
    <>
      <SectionHeader title={t('today.todaysTraining')} />
      <View style={[noDayCardStyles.card, { backgroundColor: colors.bg2, borderRadius: Radius.lg }]}>
        <Text style={[noDayCardStyles.title, { color: colors.label }]}>
          {t('today.noTrainingForToday')}
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

/**
 * Apply a server completion response to the TanStack Query cache.
 *
 * Optimistic state (written in onMutate) is always the source of truth for
 * `completedExerciseIdsBySectionAndSession`. This function only updates
 * `versionBySession` from the response so subsequent requests use the correct
 * optimistic-concurrency token.
 *
 * The previous session-source branch that re-derived per-section completion
 * from `completedExerciseCount >= totalExerciseCount` was removed because the
 * backend counts unique catalog ids for `completedExerciseCount` but
 * `totalExerciseCount` is `Sections.SelectMany(s => s.Exercises).Count` —
 * including duplicates when the same catalog exercise appears in multiple
 * sections. This made `isSessionComplete` evaluate to false even after a
 * successful session mark, causing the for-loop to overwrite all sections with
 * empty arrays, undoing the correct optimistic state.
 */
function applyExerciseProgressToCache(
  queryClient: ReturnType<typeof useQueryClient>,
  sessionId: string,
  response:
    | MarkExerciseCompleteResponse
    | MarkExerciseIncompleteResponse
    | MarkSessionCompleteResponse
    | MarkSessionIncompleteResponse,
): void {
  queryClient.setQueryData<TodayTrainingResponse>(['today-training'], (prev) => {
    if (!prev) return prev

    const prevVersion = (prev.versionBySession ?? {})[sessionId] ?? 1

    return {
      ...prev,
      versionBySession: {
        ...(prev.versionBySession ?? {}),
        [sessionId]: response.version ?? prevVersion,
      },
    }
  })
}

// ─── Component ──────────────────────────────────────────────────────

interface HasTrainerStateProps {
  /** Optional banner element rendered between the stat strip and the rest of the page. */
  topBanner?: React.ReactNode
}

export function HasTrainerState({ topBanner }: HasTrainerStateProps = {}) {
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

  // ── Mutation: toggle a single exercise complete/incomplete ─────────────────
  const toggleExerciseMutation = useMutation({
    mutationFn: async ({
      sessionId,
      sectionId,
      exerciseExternalId,
      complete,
    }: {
      sessionId: string
      sectionId: string
      exerciseExternalId: string
      complete: boolean
    }) => {
      const cache = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])
      const version = (cache?.versionBySession ?? {})[sessionId]
      const req = { version, sectionId }
      if (complete) {
        return markExerciseComplete(sessionId, exerciseExternalId, req)
      } else {
        return markExerciseIncomplete(sessionId, exerciseExternalId, req)
      }
    },
    onMutate: async ({ sessionId, sectionId, exerciseExternalId, complete }) => {
      await queryClient.cancelQueries({ queryKey: ['today-training'] })
      const previous = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])
      if (previous) {
        // Write to completedExerciseIdsBySectionAndSession so the per-section
        // set for this exact section is updated. Other sections' sets are
        // untouched — fixes the cross-section bleed bug.
        const prevBySectionAndSession = previous.completedExerciseIdsBySectionAndSession ?? {}
        const prevSessionSections: Record<string, string[]> = {
          ...(prevBySectionAndSession[sessionId] ?? {}),
        }
        const prevSectionIds: string[] = prevSessionSections[sectionId] ?? []
        const nextIdsSet = new Set(prevSectionIds)
        if (complete) {
          nextIdsSet.add(exerciseExternalId)
        } else {
          nextIdsSet.delete(exerciseExternalId)
        }
        prevSessionSections[sectionId] = Array.from(nextIdsSet)

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
        // Only write the set-numbers entry when there are actual planned sets.
        // An empty array would produce `[exerciseExternalId]: []` in the cache —
        // cosmetically harmless but semantically wrong (backend returns no sets).
        const nextSetsForSession: Record<string, number[]> = complete
          ? {
              ...prevSessionSetsMap,
              ...(plannedSetNumbers.length > 0 ? { [exerciseExternalId]: plannedSetNumbers } : {}),
            }
          : (({ [exerciseExternalId]: _omitted, ...rest }) => rest)(prevSessionSetsMap)

        queryClient.setQueryData<TodayTrainingResponse>(['today-training'], {
          ...previous,
          completedExerciseIdsBySectionAndSession: {
            ...prevBySectionAndSession,
            [sessionId]: prevSessionSections,
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
      applyExerciseProgressToCache(queryClient, sessionId, response)
      queryClient.invalidateQueries({ queryKey: ['compliance-score'] })
    },
  })

  // ── Mutation: toggle a single section complete/incomplete ─────────────────
  // Used for sections that don't track at the exercise level (typically
  // ForTime workouts that are just a name + time cap, e.g. "Running").
  const toggleSectionMutation = useMutation({
    mutationFn: async ({
      sessionId,
      sectionId,
      complete,
    }: {
      sessionId: string
      sectionId: string
      complete: boolean
    }) => {
      const cache = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])
      const version = (cache?.versionBySession ?? {})[sessionId]
      const req = { version }
      if (complete) {
        return markSectionComplete(sessionId, sectionId, req)
      } else {
        return markSectionIncomplete(sessionId, sectionId, req)
      }
    },
    onMutate: async ({ sessionId, sectionId, complete }) => {
      await queryClient.cancelQueries({ queryKey: ['today-training'] })
      const previous = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])
      if (previous) {
        const prevIds: string[] = (previous.completedSectionIdsBySession ?? {})[sessionId] ?? []
        const nextIdsSet = new Set(prevIds)
        if (complete) nextIdsSet.add(sectionId)
        else nextIdsSet.delete(sectionId)
        queryClient.setQueryData<TodayTrainingResponse>(['today-training'], {
          ...previous,
          completedSectionIdsBySession: {
            ...(previous.completedSectionIdsBySession ?? {}),
            [sessionId]: Array.from(nextIdsSet),
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
    onSuccess: () => {
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
        // NOTE: do NOT bump versionBySession here (see toggleExerciseMutation
        // for the full rationale).
        //
        // When marking a session complete, write per-section id lists into
        // completedExerciseIdsBySectionAndSession so the per-section sets
        // reflect the full section exercise ids immediately.
        // When unmarking, clear every section's list for this session.
        // Also build planned-sets sub-map for the per-set ✓ column.
        const prevBySectionAndSession = previous.completedExerciseIdsBySectionAndSession ?? {}
        const nextSessionSections: Record<string, string[]> = {}
        const plannedSetsByEx: Record<string, number[]> = {}
        // Section-id list for the "all sections of this session are done"
        // optimistic update — required because workouts with NO trackable
        // exercises (e.g. ForTime "Beh") are marked complete via
        // `completedSectionIdsBySession`, not the per-exercise map. The
        // session-complete API response doesn't return this field, so
        // populating it here is the only thing that makes the exercise-
        // free workout flip to "done" before the next refetch.
        const allSectionIds: string[] = []

        for (const sec of session?.sections ?? []) {
          if (!sec.sectionId) continue
          const trackableIds = (sec.exercises ?? [])
            .map((e) => e.exerciseExternalId)
            .filter((id): id is string => id != null)
          nextSessionSections[sec.sectionId] = complete ? trackableIds : []
          allSectionIds.push(sec.sectionId)
        }

        // Flat planned-sets map (keyed by exId) for the per-set column.
        // Falls back to session.exercises when sections aren't available.
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
          completedExerciseIdsBySectionAndSession: {
            ...prevBySectionAndSession,
            [sessionId]: nextSessionSections,
          },
          completedSectionIdsBySession: {
            ...(previous.completedSectionIdsBySession ?? {}),
            // Mark every section in the session as complete (covers
            // exercise-free WOD sections like ForTime). On uncomplete,
            // clear the list so those sections flip back to "not done".
            [sessionId]: complete ? allSectionIds : [],
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
      applyExerciseProgressToCache(queryClient, sessionId, response)
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

  const handleToggleExercise = useCallback(
    (sessionId: string, sectionId: string, exerciseExternalId: string) => {
      const ids = completedIdsForSection(sessionId, sectionId)
      const complete = !ids.has(exerciseExternalId)
      toggleExerciseMutation.mutate({ sessionId, sectionId, exerciseExternalId, complete })
    },
    [toggleExerciseMutation, completedIdsForSection],
  )

  /**
   * Batch handler for section/workout-complete toggles.
   *
   * Unlike the sequential-mutateAsync loop it replaces, this applies ONE
   * combined optimistic setQueryData upfront so ALL exercise checkboxes flip
   * at the same instant (no sequential "wave"). HTTP requests are then issued
   * one at a time in the background, each reading the latest version token
   * from the cache after the previous response has updated it, preserving the
   * server's optimistic-concurrency invariant.
   *
   * single-exercise toggles (individual exercise row taps) still go through
   * toggleExerciseMutation — this handler is only for batch operations.
   *
   * `sectionId` is now required so each HTTP request carries the correct section
   * context, preventing cross-section bleed on the backend.
   */
  const handleToggleExercises = useCallback(
    async (sessionId: string, sectionId: string, exerciseIds: string[], complete: boolean) => {
      // ── Step 1: cancel in-flight queries and snapshot the cache ──────────
      await queryClient.cancelQueries({ queryKey: ['today-training'] })
      const previous = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])

      // ── Step 2: apply ONE combined optimistic update ──────────────────────
      if (previous) {
        const session = (previous.sessions ?? []).find((s) => s.sessionId === sessionId)

        // Write to completedExerciseIdsBySectionAndSession[sessionId][sectionId].
        const prevBySectionAndSession = previous.completedExerciseIdsBySectionAndSession ?? {}
        const prevSessionSections: Record<string, string[]> = {
          ...(prevBySectionAndSession[sessionId] ?? {}),
        }
        const prevSectionIds: string[] = prevSessionSections[sectionId] ?? []
        const nextIdsSet = new Set(prevSectionIds)

        // Build a per-exercise planned-sets map for every id in the batch,
        // mirroring the per-exercise logic in toggleExerciseMutation.onMutate
        // but applied to the whole batch at once.
        const prevSessionSetsMap: Record<string, number[]> =
          (previous.completedSetsBySessionExercise ?? {})[sessionId] ?? {}
        let nextSetsForSession: Record<string, number[]> = { ...prevSessionSetsMap }

        for (const exId of exerciseIds) {
          if (complete) {
            nextIdsSet.add(exId)
            // Write planned set numbers so per-set ✓ column fills immediately.
            const plannedEx = session?.exercises?.find((e) => e.exerciseExternalId === exId)
            const plannedSetNumbers = (plannedEx?.sets ?? [])
              .map((s) => s.setNumber)
              .filter((n): n is number => n != null)
              .sort((a, b) => a - b)
            if (plannedSetNumbers.length > 0) {
              nextSetsForSession[exId] = plannedSetNumbers
            }
          } else {
            nextIdsSet.delete(exId)
            // Remove set-level entry so per-set ✓ column clears immediately.
            const { [exId]: _omitted, ...rest } = nextSetsForSession
            nextSetsForSession = rest
          }
        }

        prevSessionSections[sectionId] = Array.from(nextIdsSet)

        // NOTE: do NOT bump versionBySession here — the server response is
        // what advances the version token (same rationale as toggleExerciseMutation).
        queryClient.setQueryData<TodayTrainingResponse>(['today-training'], {
          ...previous,
          completedExerciseIdsBySectionAndSession: {
            ...prevBySectionAndSession,
            [sessionId]: prevSessionSections,
          },
          completedSetsBySessionExercise: {
            ...(previous.completedSetsBySessionExercise ?? {}),
            [sessionId]: nextSetsForSession,
          },
        })
      }

      // ── Step 3: serialize HTTP requests in the background ─────────────────
      // Read the version from cache before each request — applyExerciseProgressToCache
      // in step 4 updates it after each response, so the next request sees the
      // correct token and avoids 409s.
      const cache = () => queryClient.getQueryData<TodayTrainingResponse>(['today-training'])

      for (const exId of exerciseIds) {
        try {
          const version = (cache()?.versionBySession ?? {})[sessionId]
          const req = { version, sectionId }
          const response = complete
            ? await markExerciseComplete(sessionId, exId, req)
            : await markExerciseIncomplete(sessionId, exId, req)

          // ── Step 5: apply server response to cache after each success ────
          // Same as toggleExerciseMutation.onSuccess — updates versionBySession
          // so the next iteration reads the correct token.
          applyExerciseProgressToCache(queryClient, sessionId, response)
        } catch {
          // ── Step 6: on error, restore snapshot and stop ──────────────────
          if (previous) {
            queryClient.setQueryData(['today-training'], previous)
          }
          queryClient.invalidateQueries({ queryKey: ['today-training'] })
          break
        }
      }

      // ── Step 7: invalidate compliance score once after the whole batch ────
      queryClient.invalidateQueries({ queryKey: ['compliance-score'] })
    },
    [queryClient],
  )

  const handleToggleSection = useCallback(
    (sessionId: string, sectionId: string) => {
      const ids = completedSectionIdsFor(sessionId)
      const complete = !ids.has(sectionId)
      toggleSectionMutation.mutate({ sessionId, sectionId, complete })
    },
    [toggleSectionMutation, completedSectionIdsFor],
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

  // ── Mutation: mark every training session for the day complete ─────────────
  const markAllTrainingDoneMutation = useMutation({
    mutationFn: () => markWholeDayComplete({}),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['today-training'] })
      const previous = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])
      if (previous) {
        const prevBySectionAndSession = previous.completedExerciseIdsBySectionAndSession ?? {}
        const nextBySectionAndSession: Record<string, Record<string, string[]>> = {
          ...prevBySectionAndSession,
        }
        const nextSetsBySessionExercise: Record<string, Record<string, number[]>> = {
          ...(previous.completedSetsBySessionExercise ?? {}),
        }

        const nextCompletedSectionIdsBySession: Record<string, string[]> = {
          ...(previous.completedSectionIdsBySession ?? {}),
        }

        for (const session of previous.sessions ?? []) {
          const sessionId = session.sessionId
          if (!sessionId) continue
          // Skip sessions that are already complete — no-op, same as toggleSession.
          if (sessionCompleteMap[sessionId]) continue

          const nextSessionSections: Record<string, string[]> = {}
          const plannedSetsByEx: Record<string, number[]> = {}

          // Collect all section IDs for this session so empty-exercise sections
          // immediately reflect as complete in the optimistic cache (#259 fix).
          const allSectionIds: string[] = (session.sections ?? [])
            .map((sec) => sec.sectionId)
            .filter((id): id is string => id != null)

          for (const sec of session.sections ?? []) {
            if (!sec.sectionId) continue
            const trackableIds = (sec.exercises ?? [])
              .map((e) => e.exerciseExternalId)
              .filter((id): id is string => id != null)
            nextSessionSections[sec.sectionId] = trackableIds
          }

          // Build planned-sets map from flat exercises list for the per-set ✓ column.
          for (const ex of session.exercises ?? []) {
            const exId = ex.exerciseExternalId
            if (!exId) continue
            const nums = (ex.sets ?? [])
              .map((s) => s.setNumber)
              .filter((n): n is number => n != null)
              .sort((a, b) => a - b)
            if (nums.length > 0) plannedSetsByEx[exId] = nums
          }

          nextBySectionAndSession[sessionId] = nextSessionSections
          nextSetsBySessionExercise[sessionId] = plannedSetsByEx
          nextCompletedSectionIdsBySession[sessionId] = allSectionIds
        }

        queryClient.setQueryData<TodayTrainingResponse>(['today-training'], {
          ...previous,
          completedExerciseIdsBySectionAndSession: nextBySectionAndSession,
          completedSetsBySessionExercise: nextSetsBySessionExercise,
          completedSectionIdsBySession: nextCompletedSectionIdsBySession,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-score'] })
    },
  })

  const handleMarkAllTrainingDone = useCallback(() => {
    // Skip if every session is already marked complete.
    const hasIncomplete = todaySessions.some(
      (s) => s.sessionId != null && !sessionCompleteMap[s.sessionId],
    )
    if (!hasIncomplete) return
    markAllTrainingDoneMutation.mutate()
  }, [todaySessions, sessionCompleteMap, markAllTrainingDoneMutation])

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
                          hrefParams('/(client)/(tabs)/plans/[planId]', {
                            planId: training.planId!,
                            type: 'training',
                          }),
                        )
                      }}
                      hitSlop={8}
                    >
                      <Text style={[styles.trainingDetailAction, { color: colors.gold }]}>
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
              isMarkAllTrainingLoading={markAllTrainingDoneMutation.isPending}
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
              isMarkAllLoading={markAllEatenMutation.isPending}
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

      {/* Hydration card — always visible, MMKV-local, no trainer dependency */}
      <View style={styles.section}>
        <HydrationCard />
      </View>

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
  trainingDetailAction: {
    ...Type.subheadline,
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
