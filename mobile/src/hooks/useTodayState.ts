import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth'
import { useTodayStore, type PendingPlan } from '@/stores/todayStore'
import { getFullPlan, getClientPlans, type FullPlanResponse } from '@/api/nutrition'
import { getCollaborations } from '@/api/profile'

// ─── Helpers ─────────────────────────────────────────────────────────

/** Compute average daily kcal from the first week's meal data. */
function computeDailyKcalFromMeals(plan: FullPlanResponse): number {
  // Generated types make array fields optional; guard with ?. and ?? [].
  const week = (plan.weeks ?? [])[0]
  if (!week?.days?.length) return 0
  let total = 0
  let count = 0
  for (const day of week.days) {
    const dayKcal = day.dayTotals?.kcal
      ?? (day.meals ?? []).reduce((sum, m) => sum + (m.mealTotals?.kcal ?? 0), 0)
    if (dayKcal > 0) {
      total += dayKcal
      count++
    }
  }
  return count > 0 ? Math.round(total / count) : 0
}

function buildNutritionPending(
  plan: FullPlanResponse,
  trainerName: string,
  weeksLabel: string,
): PendingPlan {
  const kcal = plan.globalSettings?.dailyKcal
    ? Math.round(plan.globalSettings.dailyKcal)
    : computeDailyKcalFromMeals(plan)

  const chips: string[] = []
  if (kcal > 0) chips.push(`${kcal} kcal/day`)
  chips.push(weeksLabel)

  return {
    planId: plan.planId ?? '',
    type: 'nutrition',
    name: '',
    trainerName,
    chips,
    startDate: plan.startDate ?? '',
    accentColor: '#34c759',
  }
}

// ─── Hook ────────────────────────────────────────────────────────────

/**
 * Resolves the Today screen state from auth + API data and syncs it
 * into `useTodayStore`.
 *
 * State resolution:
 *   1. No active link            → 'no-trainer'
 *   2. Otherwise (active plan,
 *      pending plans, or waiting
 *      for plans)                → 'has-trainer'
 *
 * Pending plans (future start date) are stored in `useTodayStore.pendingPlans`
 * and rendered as additive banners inside `HasTrainerState` — they do NOT
 * replace the full dashboard with a separate top-level state.
 */
export function useTodayState() {
  const { t } = useTranslation()
  const hasActiveLink = useAuthStore((s) => s.user?.hasActiveLink ?? false)
  const setState = useTodayStore((s) => s.setState)
  const setPendingPlans = useTodayStore((s) => s.setPendingPlans)

  // Full nutrition plan — returns currentWeek: null when plan is upcoming
  const { data: nutritionPlan, isLoading: isLoadingNutrition } = useQuery({
    queryKey: ['nutrition-plan-full'],
    queryFn: getFullPlan,
    enabled: hasActiveLink,
    retry: false, // 404 expected when no plan exists
  })

  // Active plans list — authoritative source for pending training plan detection.
  // Shares cache with the Plans screen (same query key).
  const { data: activePlans, isLoading: isLoadingActivePlans } = useQuery({
    queryKey: ['client-plans-active'],
    queryFn: () => getClientPlans('Active'),
    enabled: hasActiveLink,
    retry: false,
  })

  // Collaborations — needed for coach/trainer name
  const { data: collabs } = useQuery({
    queryKey: ['collaborations'],
    queryFn: getCollaborations,
    enabled: hasActiveLink,
  })

  useEffect(() => {
    // ── No trainer / coach → no-trainer ──
    if (!hasActiveLink) {
      setState('no-trainer')
      setPendingPlans([])
      return
    }

    // ── Still loading initial data → keep current state ──
    // Wait for both queries to settle before re-deriving state to avoid
    // transiently showing the wrong banner on initial hydration.
    if (isLoadingNutrition || isLoadingActivePlans) return

    // ── Build pending plans list ──
    const pending: PendingPlan[] = []
    const now = new Date()

    // Check for pending nutrition plan (API-driven)
    if (
      nutritionPlan &&
      nutritionPlan.currentWeek === null &&
      nutritionPlan.startDate
    ) {
      const startDate = new Date(nutritionPlan.startDate)
      if (startDate > now) {
        // Nutritionist has role 'Nutritionist' in collaborations
        const nutritionist = collabs?.find((c) => c.role === 'Nutritionist')
        const name = nutritionist?.professionalName ?? ''
        const weeksLabel = t('today.weeksCount', { count: nutritionPlan.publishedWeekCount })
        pending.push(buildNutritionPending(nutritionPlan, name, weeksLabel))
      }
    }

    // Check for pending training plans (API-driven via getClientPlans('Active')).
    // A training plan is pending when it has no current week yet but has a
    // future start date — i.e. the trainer published it but it hasn't started.
    if (activePlans?.items) {
      const trainer = collabs?.find((c) => c.role === 'Trainer')
      const trainerName = trainer?.professionalName ?? ''

      for (const item of activePlans.items) {
        if (
          item.type === 'training' &&
          item.currentWeek == null &&
          item.startDate &&
          new Date(item.startDate) > now
        ) {
          const pendingTraining: PendingPlan = {
            planId: item.planId ?? '',
            type: 'training',
            name: item.planName ?? '',
            trainerName,
            chips: [],
            startDate: item.startDate ?? '',
            accentColor: '#c9a84c',
          }
          pending.push(pendingTraining)
        }
      }
    }

    // ── Resolve final state ──
    // Pending plans are additive banners inside HasTrainerState, not a
    // separate top-level state. Always resolve to 'has-trainer' when linked.
    setPendingPlans(pending)
    setState('has-trainer')
  }, [hasActiveLink, nutritionPlan, isLoadingNutrition, isLoadingActivePlans, activePlans, collabs, setState, setPendingPlans, t])
}
