import type { EditorDay, EditorMeal, EditorWeek } from '@/components/plan-editor/plan-editor-types';

export interface Totals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export const ZERO_TOTALS: Totals = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function addTotals(left: Totals, right: Totals): Totals {
  return {
    kcal: left.kcal + right.kcal,
    protein: left.protein + right.protein,
    carbs: left.carbs + right.carbs,
    fat: left.fat + right.fat,
    fiber: left.fiber + right.fiber,
  };
}

function roundTotals(totals: Totals): Totals {
  return {
    kcal: round1(totals.kcal),
    protein: round1(totals.protein),
    carbs: round1(totals.carbs),
    fat: round1(totals.fat),
    fiber: round1(totals.fiber),
  };
}

/**
 * A meal's totals, mirroring the server's `MacroCalculatorService.CalculateMealTotals`:
 * a food contributes grams / 100 x its per-100g value, a recipe its per-serving value x servings,
 * a missing fiber counts as 0, and the result is rounded to one decimal.
 */
export function mealTotals(meal: EditorMeal): Totals {
  let totals = ZERO_TOTALS;
  for (const food of meal.foods) {
    const ratio = food.amountGrams / 100;
    const per100 = food.nutrientValuePer100Grams;
    totals = addTotals(totals, {
      kcal: (per100.kcal ?? 0) * ratio,
      protein: (per100.protein ?? 0) * ratio,
      carbs: (per100.carbs ?? 0) * ratio,
      fat: (per100.fat ?? 0) * ratio,
      fiber: (per100.fiber ?? 0) * ratio,
    });
  }
  for (const recipe of meal.recipes) {
    const perServing = recipe.nutrientValuePerServing;
    totals = addTotals(totals, {
      kcal: (perServing.kcal ?? 0) * recipe.servings,
      protein: (perServing.protein ?? 0) * recipe.servings,
      carbs: (perServing.carbs ?? 0) * recipe.servings,
      fat: (perServing.fat ?? 0) * recipe.servings,
      fiber: (perServing.fiber ?? 0) * recipe.servings,
    });
  }
  return roundTotals(totals);
}

export function mealItemCount(meal: EditorMeal): number {
  return meal.foods.length + meal.recipes.length;
}

export function dayTotals(day: EditorDay): Totals {
  return roundTotals(day.meals.reduce((sum, meal) => addTotals(sum, mealTotals(meal)), ZERO_TOTALS));
}

export function dayHasItems(day: EditorDay): boolean {
  return day.meals.some((meal) => mealItemCount(meal) > 0);
}

export interface WeekSummary {
  total: Totals;
  /** Average over the days that have at least one item. */
  average: Totals;
  activeDays: number;
}

export function weekSummary(week: EditorWeek): WeekSummary {
  const activeDays = week.days.filter(dayHasItems);
  const total = roundTotals(activeDays.reduce((sum, day) => addTotals(sum, dayTotals(day)), ZERO_TOTALS));
  const divisor = activeDays.length || 1;
  return {
    total,
    average: roundTotals({
      kcal: total.kcal / divisor,
      protein: total.protein / divisor,
      carbs: total.carbs / divisor,
      fat: total.fat / divisor,
      fiber: total.fiber / divisor,
    }),
    activeDays: activeDays.length,
  };
}

export type TargetStatus = 'none' | 'on' | 'near' | 'off';

/** Day total against the daily target: within 10% on, 10-20% near, beyond that off. */
export function targetStatus(kcal: number, target: number | undefined): TargetStatus {
  if (!target || kcal <= 0) {
    return 'none';
  }
  const deviation = Math.abs(kcal - target) / target;
  if (deviation <= 0.1) {
    return 'on';
  }
  return deviation <= 0.2 ? 'near' : 'off';
}
