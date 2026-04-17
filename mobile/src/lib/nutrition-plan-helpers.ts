import i18n from '@/i18n'
import type { MealFood, MealRecipe, PlanMeal } from '@/api/nutrition'

const DAY_LABELS_SHORT: Record<string, string[]> = {
  cs: ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  de: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
}

export function getDayLabels(): string[] {
  return DAY_LABELS_SHORT[i18n.language] ?? DAY_LABELS_SHORT.en
}

export function formatWeekRange(startDate: string, endDate: string): string {
  const locale = i18n.language
  const start = new Date(startDate)
  const end = new Date(endDate)
  const fmt = (d: Date) =>
    d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

export function getDayDate(weekStartDate: string, dayOfWeek: number): number {
  const start = new Date(weekStartDate)
  const d = new Date(start)
  d.setDate(start.getDate() + (dayOfWeek - 1))
  return d.getDate()
}

export function computeFoodKcal(food: MealFood): number {
  // nutrientValuePer100Grams and kcal are optional in the generated type but
  // always populated at runtime when a plan is loaded from the server.
  return ((food.nutrientValuePer100Grams?.kcal ?? 0) * (food.amountGrams ?? 0)) / 100
}

export function computeRecipeKcal(recipe: MealRecipe): number {
  // nutrientValuePerServing and kcal are optional in the generated type but
  // always populated at runtime when a plan is loaded from the server.
  return (recipe.nutrientValuePerServing?.kcal ?? 0) * (recipe.servings ?? 1)
}

export function totalMealItems(meal: PlanMeal): number {
  return (meal.foods?.length ?? 0) + (meal.recipes?.length ?? 0)
}
