import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth'
import { getFullPlan, getClientPlans, type FullPlanResponse } from '@/api/nutrition'
import { getCollaborations } from '@/api/profile'

// ─── Types ───────────────────────────────────────────────────────────
//
// Previously sourced from the (now-deleted) `todayStore`. Defined locally so
// this hook has no dependency on any UI-layer store. `accentColor` was
// dropped — it was purely a presentation concern (consumed by the deleted
// `NoteBanner`/`PlanBanner` components); the new design system will decide
// how to color pending-plan banners.
export type TodayState = 'no-trainer' | 'has-trainer'

export interface PendingPlan {
  planId: string
  type: 'training' | 'nutrition'
  name: string
  trainerName: string
  chips: string[]   // e.g. ["1 700 kcal/day", "3 weeks"]
  startDate: string  // ISO date string
}

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
  }
}

// ─── Hook ────────────────────────────────────────────────────────────

export interface UseTodayStateResult {
  state: TodayState
  pendingPlans: PendingPlan[]
  isLoading: boolean
}

/**
 * Resolves the Today screen state from auth + API data.
 *
 * State resolution:
 *   1. No active link → 'no-trainer'
 *   2. Otherwise (active plan, pending plans, or waiting for plans) → 'has-trainer'
 *
 * Pending plans (future start date) are returned in `pendingPlans` for the
 * caller to render as additive banners — they do NOT imply a separate
 * top-level state.
 *
 * NOTE: this used to sync `state`/`pendingPlans` into the (now-deleted)
 * `todayStore` via a `useEffect`. That UI-state store was removed as part
 * of the clean-slate UI redesign; the derivation itself is unchanged, just
 * returned directly instead of written into an external store. Re-wire a
 * store subscription here if/when the new design system needs one.
 */
export function useTodayState(): UseTodayStateResult {
  const { t } = useTranslation()
  const hasActiveLink = useAuthStore((s) => s.user?.hasActiveLink ?? false)

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

  const isLoading = isLoadingNutrition || isLoadingActivePlans

  return useMemo<UseTodayStateResult>(() => {
    // ── No trainer / coach → no-trainer ──
    if (!hasActiveLink) {
      return { state: 'no-trainer', pendingPlans: [], isLoading: false }
    }

    // ── Still loading initial data → keep the previous shape, empty pending ──
    if (isLoading) {
      return { state: 'has-trainer', pendingPlans: [], isLoading: true }
    }

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
          pending.push({
            planId: item.planId ?? '',
            type: 'training',
            name: item.planName ?? '',
            trainerName,
            chips: [],
            startDate: item.startDate ?? '',
          })
        }
      }
    }

    // ── Resolve final state ──
    // Pending plans are additive banners, not a separate top-level state.
    // Always resolve to 'has-trainer' when linked.
    return { state: 'has-trainer', pendingPlans: pending, isLoading: false }
  }, [hasActiveLink, isLoading, nutritionPlan, activePlans, collabs, t])
}
