import { MealKind, type GlobalNutritionSettings, type PlanWeek, type UpdateWeekRequest } from '@/api/generated';
import type { EditorMeal, EditorWeek, PlanTargets } from '@/components/plan-editor/plan-editor-types';

export function nullToUndefined<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

/** Maps stored weeks (template or client plan) to the editor's weeks. Stored totals are ignored. */
export function toEditorWeeks(source: readonly PlanWeek[] | undefined): EditorWeek[] {
  return [...(source ?? [])]
    .sort((left, right) => (left.weekNumber ?? 0) - (right.weekNumber ?? 0))
    .map((week, weekIndex) => ({
      weekNumber: week.weekNumber ?? weekIndex + 1,
      days: [...(week.days ?? [])]
        .sort((left, right) => (left.dayOfWeek ?? 0) - (right.dayOfWeek ?? 0))
        .map((day) => ({
          dayOfWeek: day.dayOfWeek ?? 1,
          note: nullToUndefined(day.note),
          meals: [...(day.meals ?? [])]
            .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
            .map((meal, mealIndex): EditorMeal => ({
              mealId: meal.mealId ?? crypto.randomUUID(),
              kind: meal.kind ?? MealKind.Breakfast,
              order: meal.order ?? mealIndex + 1,
              time: nullToUndefined(meal.time),
              note: nullToUndefined(meal.note),
              foods: (meal.foods ?? []).map((food) => ({
                foodExternalId: food.foodExternalId ?? '',
                foodName: food.foodName ?? '',
                foodNameCs: nullToUndefined(food.foodNameCs),
                foodNameEn: nullToUndefined(food.foodNameEn),
                foodNameDe: nullToUndefined(food.foodNameDe),
                foodCategory: nullToUndefined(food.foodCategory),
                nutrientValuePer100Grams: food.nutrientValuePer100Grams ?? {},
                amountGrams: food.amountGrams ?? 0,
                note: nullToUndefined(food.note),
              })),
              recipes: (meal.recipes ?? []).map((recipe) => ({
                recipeId: recipe.recipeId ?? '',
                recipeName: recipe.recipeName ?? '',
                nutrientValuePerServing: recipe.nutrientValuePerServing ?? {},
                servings: recipe.servings ?? 1,
                note: nullToUndefined(recipe.note),
                foodCategories: nullToUndefined(recipe.foodCategories),
              })),
            })),
        })),
    }));
}

export function toEditorTargets(settings: GlobalNutritionSettings | null | undefined): PlanTargets {
  return {
    kcal: nullToUndefined(settings?.dailyKcal),
    protein: nullToUndefined(settings?.proteinGrams),
    carbs: nullToUndefined(settings?.carbsGrams),
    fat: nullToUndefined(settings?.fatGrams),
    fiber: nullToUndefined(settings?.fiberGrams),
  };
}

export function toGlobalSettings(targets: PlanTargets): GlobalNutritionSettings | undefined {
  const settings: GlobalNutritionSettings = {
    dailyKcal: targets.kcal,
    proteinGrams: targets.protein,
    carbsGrams: targets.carbs,
    fatGrams: targets.fat,
    fiberGrams: targets.fiber,
  };
  return Object.values(settings).some((value) => value !== undefined) ? settings : undefined;
}

function toRequestMeal(meal: EditorMeal) {
  return {
    mealId: meal.mealId,
    kind: meal.kind,
    order: meal.order,
    time: meal.time,
    note: meal.note,
    foods: meal.foods.map((food) => ({ ...food })),
    recipes: meal.recipes.map((recipe) => ({ ...recipe })),
  };
}

/** The request shape for weeks is the same for templates and client plans. */
export function toRequestWeeks(weeks: EditorWeek[]): UpdateWeekRequest[] {
  return weeks.map((week) => ({
    weekNumber: week.weekNumber,
    days: week.days.map((day) => ({
      dayOfWeek: day.dayOfWeek,
      note: day.note,
      meals: day.meals.map(toRequestMeal),
    })),
  }));
}
