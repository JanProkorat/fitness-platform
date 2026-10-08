import { MealKind } from '@/api/generated';
import { foodDisplayName } from '@/components/plan-editor/plan-editor-library';
import type {
  EditorDay,
  EditorFood,
  EditorMeal,
  EditorRecipe,
  EditorWeek,
} from '@/components/plan-editor/plan-editor-types';

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
    totals = addTotals(totals, rawFoodTotals(food));
  }
  for (const recipe of meal.recipes) {
    totals = addTotals(totals, rawRecipeTotals(recipe));
  }
  return roundTotals(totals);
}

function rawFoodTotals(food: EditorFood): Totals {
  const ratio = food.amountGrams / 100;
  const per100 = food.nutrientValuePer100Grams;
  return {
    kcal: (per100.kcal ?? 0) * ratio,
    protein: (per100.protein ?? 0) * ratio,
    carbs: (per100.carbs ?? 0) * ratio,
    fat: (per100.fat ?? 0) * ratio,
    fiber: (per100.fiber ?? 0) * ratio,
  };
}

function rawRecipeTotals(recipe: EditorRecipe): Totals {
  const perServing = recipe.nutrientValuePerServing;
  return {
    kcal: (perServing.kcal ?? 0) * recipe.servings,
    protein: (perServing.protein ?? 0) * recipe.servings,
    carbs: (perServing.carbs ?? 0) * recipe.servings,
    fat: (perServing.fat ?? 0) * recipe.servings,
    fiber: (perServing.fiber ?? 0) * recipe.servings,
  };
}

/** One ingredient's totals at its current amount. */
export function foodTotals(food: EditorFood): Totals {
  return roundTotals(rawFoodTotals(food));
}

/** One recipe's totals at its current servings. */
export function recipeTotals(recipe: EditorRecipe): Totals {
  return roundTotals(rawRecipeTotals(recipe));
}

/** Each meal's share of the daily kcal target on the boards, in percent. Other kinds have none. */
export const MEAL_SHARE_PERCENT: Partial<Record<MealKind, number>> = {
  [MealKind.Breakfast]: 25,
  [MealKind.MorningSnack]: 10,
  [MealKind.Lunch]: 30,
  [MealKind.Dinner]: 28,
  [MealKind.AfternoonSnack]: 7,
};

/** A meal is "on target" while it stays within this fraction of its expected value. */
const SHARE_BAND = 0.15;

export type ShareStatus = 'none' | 'on' | 'over' | 'under';

export interface ShareResult {
  status: ShareStatus;
  /** Signed deviation from the expected value, in whole percent. */
  deviationPercent: number;
}

/** Compares an actual value with what a meal of this kind should carry; `expected` is in the same unit. */
export function shareStatus(actual: number, expected: number): ShareResult {
  if (expected <= 0) {
    return { status: 'none', deviationPercent: 0 };
  }
  const deviation = actual / expected - 1;
  const deviationPercent = Math.round(deviation * 100);
  if (Math.abs(deviation) <= SHARE_BAND) {
    return { status: 'on', deviationPercent };
  }
  return { status: deviation > 0 ? 'over' : 'under', deviationPercent };
}

/** A meal's kcal against its fixed share of the daily kcal target. */
export function mealKcalStatus(kcal: number, kind: MealKind, dailyTarget: number | undefined): ShareResult {
  const share = MEAL_SHARE_PERCENT[kind];
  if (!dailyTarget || share === undefined) {
    return { status: 'none', deviationPercent: 0 };
  }
  return shareStatus(kcal, (dailyTarget * share) / 100);
}

/** A meal's part of the day's kcal against the share its kind should have. */
export function mealDayShareStatus(kcal: number, dayKcal: number, kind: MealKind): ShareResult {
  const share = MEAL_SHARE_PERCENT[kind];
  if (dayKcal <= 0 || share === undefined) {
    return { status: 'none', deviationPercent: 0 };
  }
  return shareStatus((kcal / dayKcal) * 100, share);
}

/** One recipe or ingredient of a meal, flattened for display; `index` is its position in its own list. */
export interface MealItemEntry {
  type: 'recipe' | 'food';
  index: number;
  name: string;
  amount: number;
  totals: Totals;
}

/** A meal's items, recipes first (the order the week grid names them in). */
export function mealItemEntries(meal: EditorMeal, language: string): MealItemEntry[] {
  return [
    ...meal.recipes.map(
      (recipe, index): MealItemEntry => ({
        type: 'recipe',
        index,
        name: recipe.recipeName,
        amount: recipe.servings,
        totals: recipeTotals(recipe),
      }),
    ),
    ...meal.foods.map(
      (food, index): MealItemEntry => ({
        type: 'food',
        index,
        name: foodDisplayName(food, language),
        amount: food.amountGrams,
        totals: foodTotals(food),
      }),
    ),
  ];
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

/** Atwater energy factors, kcal per gram. */
export const KCAL_PER_GRAM_PROTEIN = 4;
export const KCAL_PER_GRAM_CARBS = 4;
export const KCAL_PER_GRAM_FAT = 9;

/** Share of the day's energy a macro supplies, as 0-100; 0 when the day has no kcal. */
export function energySharePercent(grams: number, kcalPerGram: number, dayKcal: number): number {
  if (dayKcal <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, ((grams * kcalPerGram) / dayKcal) * 100));
}

export type TargetStatus ='none' | 'on' | 'near' | 'off';

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
