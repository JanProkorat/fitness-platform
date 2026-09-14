import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  logMealEaten,
  unlogMealEaten,
  type TodayPlanResponse,
  type TodayLogResponse,
} from '@/api/nutrition'

interface UseTodayNutritionActionsArgs {
  plan: TodayPlanResponse | undefined
  eatenMealIds: Set<string>
}

/**
 * Wraps the meal-eaten mutation surface (single toggle + mark-all-remaining
 * fan-out) for `HasTrainerState`. Moved verbatim out of the component (#728,
 * PR 4/4) — every onMutate/onError/onSuccess and the optimistic macro-totals
 * arithmetic is unchanged.
 */
export function useTodayNutritionActions({ plan, eatenMealIds }: UseTodayNutritionActionsArgs) {
  const queryClient = useQueryClient()

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

  return {
    handleToggleEaten,
    handleMarkAllEaten,
    isMarkAllLoading: markAllEatenMutation.isPending,
  }
}
