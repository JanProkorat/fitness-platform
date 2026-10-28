import type { NutritionMeal } from '@/api/nutrition';
import { mealKcal } from '@/components/nutrition/meals/model';
import { dayMeals } from '@/components/nutrition/plan/model';
import type { WeekDay } from '@/components/nutrition/plan/model';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The `day` route param when it is a date inside the week; anything malformed or outside it is ignored. */
export const dayWithinWeek = (days: WeekDay[], value: string | undefined): string | undefined =>
  value !== undefined && ISO_DAY.test(value) && days.some(({ date }) => date === value) ? value : undefined;

export type DayBar = { date: string; kcal: number; hasMeals: boolean };

/** Planned kcal per day of the week: the plan's own day total, or the sum of the meals when it has none. */
export const weekBars = (days: WeekDay[]): DayBar[] =>
  days.map(({ date, day }) => {
    const meals = dayMeals(day);
    const kcal = day?.dayTotals?.kcal ?? meals.reduce((sum, meal) => sum + mealKcal(meal), 0);
    return { date, kcal, hasMeals: meals.length > 0 };
  });

/** Mean planned kcal over the days that have meals; undefined when no day has any. */
export function averageKcal(bars: DayBar[]): number | undefined {
  const planned = bars.filter(({ hasMeals }) => hasMeals);
  if (planned.length === 0) return undefined;
  return planned.reduce((sum, { kcal }) => sum + kcal, 0) / planned.length;
}

/** The kcal that fills the full bar height: the tallest of the days and the target line. */
export const barScale = (bars: DayBar[], target: number | undefined): number =>
  Math.max(target ?? 0, ...bars.map(({ kcal }) => kcal), 1);

export type DayRecipe = {
  key: string;
  recipeId: string;
  name: string;
  kind: NutritionMeal['kind'];
  servings: number;
  kcal: number;
};

/** The recipes of a day's meals, in meal order; a recipe without an id cannot be opened and is left out. */
export const dayRecipes = (meals: NutritionMeal[]): DayRecipe[] =>
  meals.flatMap((meal) =>
    (meal.recipes ?? []).flatMap((recipe, index): DayRecipe[] => {
      if (!recipe.recipeId) return [];
      const servings = recipe.servings ?? 1;
      return [
        {
          key: `${meal.mealId}-${recipe.recipeId}-${index}`,
          recipeId: recipe.recipeId,
          name: recipe.recipeName ?? '',
          kind: meal.kind,
          servings,
          kcal: Math.round((recipe.nutrientValuePerServing?.kcal ?? 0) * servings),
        },
      ];
    }),
  );
