import type { MealFood, MealRecipe, NutrientTotals } from '@/api/generated';

export type Macros = Required<NutrientTotals>;

export const EMPTY_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

/** Whole-number display in the app language. */
export const formatWhole = (language: string, value: number): string =>
  new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(value);

/** Up to one decimal, for amounts that can be fractional such as servings. */
export const formatAmount = (language: string, value: number): string =>
  new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value);

export const macrosOf = (totals: NutrientTotals | undefined): Macros => ({
  kcal: totals?.kcal ?? 0,
  protein: totals?.protein ?? 0,
  carbs: totals?.carbs ?? 0,
  fat: totals?.fat ?? 0,
  fiber: totals?.fiber ?? 0,
});

export const scaleMacros = (macros: Macros, factor: number): Macros => ({
  kcal: macros.kcal * factor,
  protein: macros.protein * factor,
  carbs: macros.carbs * factor,
  fat: macros.fat * factor,
  fiber: macros.fiber * factor,
});

export const addMacros = (first: Macros, second: Macros): Macros => ({
  kcal: first.kcal + second.kcal,
  protein: first.protein + second.protein,
  carbs: first.carbs + second.carbs,
  fat: first.fat + second.fat,
  fiber: first.fiber + second.fiber,
});

/** Nutrients of a food in the given amount; the plan stores them per 100 grams. */
export const foodMacros = (food: MealFood, amountGrams: number = food.amountGrams ?? 0): Macros =>
  scaleMacros(macrosOf(food.nutrientValuePer100Grams), amountGrams / 100);

/** Nutrients of a recipe in the plan, which stores them per serving. */
export const recipeMacros = (recipe: MealRecipe): Macros =>
  scaleMacros(macrosOf(recipe.nutrientValuePerServing), recipe.servings ?? 1);

/** The food's name in the app language, falling back to the stored name. */
export function foodName(food: MealFood, language: string): string {
  const localized = language.startsWith('cs')
    ? food.foodNameCs
    : language.startsWith('de')
      ? food.foodNameDe
      : food.foodNameEn;
  return localized || food.foodName || '';
}
