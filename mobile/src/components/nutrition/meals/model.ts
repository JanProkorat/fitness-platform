import type { NutritionMeal } from '@/api/nutrition';
import { addMacros, EMPTY_MACROS, foodMacros, macrosOf, recipeMacros } from '@/components/nutrition/meal/format';
import type { Macros } from '@/components/nutrition/meal/format';

/** Macros of a meal: the stored totals when the plan has them, otherwise the sum of its items. */
export const mealMacros = (meal: NutritionMeal): Macros =>
  meal.mealTotals
    ? macrosOf(meal.mealTotals)
    : [
        ...(meal.foods ?? []).map((food) => foodMacros(food)),
        ...(meal.recipes ?? []).map((recipe) => recipeMacros(recipe)),
      ].reduce(addMacros, EMPTY_MACROS);

export const mealKcal = (meal: NutritionMeal): number => mealMacros(meal).kcal;
