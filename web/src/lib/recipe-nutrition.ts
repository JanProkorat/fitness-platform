import type { MealFood, NutrientTotals } from '@/api/recipe-types';

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

const ZERO_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

/** A recipe's totals divided by its servings (servings below 1 count as 1). */
export function perServing(totals: NutrientTotals | undefined, servings: number | undefined): Macros {
  if (!totals) {
    return ZERO_MACROS;
  }
  const divisor = servings && servings >= 1 ? servings : 1;
  return {
    kcal: (totals.kcal ?? 0) / divisor,
    protein: (totals.protein ?? 0) / divisor,
    carbs: (totals.carbs ?? 0) / divisor,
    fat: (totals.fat ?? 0) / divisor,
  };
}

/** Macros contributed by `amountGrams` of a food with per-100g values. */
export function macrosForAmount(per100: MealFood['nutrientValuePer100Grams'], amountGrams: number): Macros {
  const factor = (Number.isFinite(amountGrams) ? amountGrams : 0) / 100;
  return {
    kcal: (per100?.kcal ?? 0) * factor,
    protein: (per100?.protein ?? 0) * factor,
    carbs: (per100?.carbs ?? 0) * factor,
    fat: (per100?.fat ?? 0) * factor,
  };
}

export function sumMacros(items: Macros[]): Macros {
  return items.reduce(
    (total, item) => ({
      kcal: total.kcal + item.kcal,
      protein: total.protein + item.protein,
      carbs: total.carbs + item.carbs,
      fat: total.fat + item.fat,
    }),
    ZERO_MACROS,
  );
}

export function divideMacros(macros: Macros, servings: number): Macros {
  const divisor = servings >= 1 ? servings : 1;
  return {
    kcal: macros.kcal / divisor,
    protein: macros.protein / divisor,
    carbs: macros.carbs / divisor,
    fat: macros.fat / divisor,
  };
}
