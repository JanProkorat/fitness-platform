import React, { useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useTodayStore } from '@/stores/todayStore'
import { getFullPlan, type FullPlanResponse } from '@/api/nutrition'
import { getCollaborations, type CollaborationDto } from '@/api/profile'
import { PlanBanner } from './PlanBanner'
import { ShoppingPrepBanner } from './ShoppingPrepBanner'
import { PrepTipsSection } from './PrepTipsSection'
import { WaitingForPlanCard } from './WaitingForPlanCard'

export function PlanPendingState() {
  const pendingPlans = useTodayStore((s) => s.pendingPlans)

  const hasTraining = pendingPlans.some((p) => p.type === 'training')
  const hasNutrition = pendingPlans.some((p) => p.type === 'nutrition')

  // Check collaborations to detect linked professionals without a pending plan
  const { data: collabs } = useQuery<CollaborationDto[]>({
    queryKey: ['collaborations'],
    queryFn: getCollaborations,
  })
  const hasTrainerLink = collabs?.some((c) => c.role === 'Trainer') ?? false
  const hasNutritionistLink = collabs?.some((c) => c.role === 'Nutritionist') ?? false
  const waitingForTraining = !hasTraining && hasTrainerLink
  const waitingForNutrition = !hasNutrition && hasNutritionistLink
  const isWaitingForAnyPlan = waitingForTraining || waitingForNutrition

  // Fetch full plan to check if week 1 is published
  const { data: fullPlan } = useQuery<FullPlanResponse>({
    queryKey: ['nutrition', 'full-plan'],
    queryFn: getFullPlan,
    enabled: hasNutrition,
    staleTime: 60_000,
  })

  // Show shopping banner on Friday+ when the plan has published weeks
  const showShoppingBanner = useMemo(() => {
    if (!hasNutrition || !fullPlan) return false
    // JS: 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
    const jsDay = new Date().getDay()
    const isFridayOrLater = jsDay >= 5 || jsDay === 0 // Fri, Sat, Sun
    return isFridayOrLater && fullPlan.publishedWeekCount >= 1
  }, [hasNutrition, fullPlan])

  return (
    <View style={styles.container}>
      {/* Plan banners */}
      <View style={styles.banners}>
        {pendingPlans.map((plan) => (
          <PlanBanner key={plan.planId} plan={plan} />
        ))}
      </View>

      {/* Shopping prep banner for week 1 */}
      {showShoppingBanner && (
        <View style={styles.section}>
          <ShoppingPrepBanner week={1} />
        </View>
      )}

      {/* Waiting for plan card (linked professional without a pending plan) */}
      {isWaitingForAnyPlan && (
        <View style={styles.section}>
          <WaitingForPlanCard
            waitingForTraining={waitingForTraining}
            waitingForNutrition={waitingForNutrition}
            hasExistingPlan
          />
        </View>
      )}

      {/* Preparation tips */}
      <View style={styles.section}>
        <PrepTipsSection
          hasTraining={hasTraining || waitingForTraining}
          hasNutrition={hasNutrition || waitingForNutrition}
        />
      </View>
    </View>
  )
}

export default PlanPendingState

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
  },
  banners: {
    paddingHorizontal: 16,
    gap: 10,
  },
  section: {
    marginTop: 20,
  },
})
