import React, { useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useTodayStore } from '@/stores/todayStore'
import { getFullPlan } from '@/api/nutrition'
import { getCollaborations, type CollaborationDto } from '@/api/profile'
import { PlanBanner } from './PlanBanner'
import { DailyMealStructureSection } from './DailyMealStructureSection'
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

  // Reuse the cached full nutrition plan for meal structure preview
  const { data: nutritionPlan } = useQuery({
    queryKey: ['nutrition-plan-full'],
    queryFn: getFullPlan,
    enabled: hasNutrition,
  })

  // Get first day's meals from the first published week
  const firstDayData = useMemo(() => {
    if (!nutritionPlan?.weeks?.length) return null
    const week = nutritionPlan.weeks[0]
    if (!week?.days?.length) return null
    // Find day 1 (Monday) or the first available day
    const day = week.days.find((d) => d.dayOfWeek === 1) ?? week.days[0]
    if (!day?.meals?.length) return null
    return day
  }, [nutritionPlan])

  return (
    <View style={styles.container}>
      {/* Plan banners */}
      <View style={styles.banners}>
        {pendingPlans.map((plan) => (
          <PlanBanner key={plan.planId} plan={plan} />
        ))}
      </View>

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

      {/* Weekly schedule — rendered when training plan data available (Phase 5) */}
      {/* {hasTraining && trainingWeekData && <WeeklyScheduleSection ... />} */}

      {/* Daily meal structure */}
      {hasNutrition && firstDayData && (
        <View style={styles.section}>
          <DailyMealStructureSection
            meals={firstDayData.meals}
            dayTotals={firstDayData.dayTotals}
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
