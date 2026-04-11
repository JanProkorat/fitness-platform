import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth'
import { useTodayStore, type PendingPlan } from '@/stores/todayStore'
import { getFullPlan, type FullPlanResponse } from '@/api/nutrition'
import { getCollaborations } from '@/api/profile'

// ─── Helpers ─────────────────────────────────────────────────────────

/** Compute average daily kcal from the first week's meal data. */
function computeDailyKcalFromMeals(plan: FullPlanResponse): number {
  const week = plan.weeks[0]
  if (!week?.days?.length) return 0
  let total = 0
  let count = 0
  for (const day of week.days) {
    const dayKcal = day.dayTotals?.kcal
      ?? day.meals.reduce((sum, m) => sum + (m.mealTotals?.kcal ?? 0), 0)
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
    planId: plan.planId,
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
 *   2. Nutrition plan published
 *      but start date in future  → 'plan-pending'
 *   3. Training plan pending
 *      (from SignalR event)      → 'plan-pending'
 *   4. Otherwise (active plan
 *      or waiting for plans)     → 'has-trainer'
 */
export function useTodayState() {
  const { t } = useTranslation()
  const hasActiveLink = useAuthStore((s) => s.user?.hasActiveLink ?? false)
  const setState = useTodayStore((s) => s.setState)
  const setPendingPlans = useTodayStore((s) => s.setPendingPlans)
  const pendingTrainingPlans = useTodayStore((s) => s.pendingTrainingPlans)

  // Full nutrition plan — returns currentWeek: null when plan is upcoming
  const { data: nutritionPlan, isLoading } = useQuery({
    queryKey: ['nutrition-plan-full'],
    queryFn: getFullPlan,
    enabled: hasActiveLink,
    retry: false, // 404 expected when no plan exists
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
    if (isLoading) return

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

    // Check for pending training plans (SignalR-driven, stored in todayStore)
    for (const tp of pendingTrainingPlans) {
      if (tp.startDate && new Date(tp.startDate) > now) {
        pending.push(tp)
      }
    }

    // ── Resolve final state ──
    if (pending.length > 0) {
      setState('plan-pending')
      setPendingPlans(pending)
    } else {
      setState('has-trainer')
      setPendingPlans([])
    }
  }, [hasActiveLink, nutritionPlan, isLoading, collabs, pendingTrainingPlans, setState, setPendingPlans, t])
}
