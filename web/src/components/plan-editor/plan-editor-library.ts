import type { FoodSummary, RecipeSummaryDto } from '@/api/generated';
import type { EditorFood, EditorMeal, LibraryItem } from '@/components/plan-editor/plan-editor-types';
import { perServing } from '@/lib/recipe-nutrition';

const DEFAULT_AMOUNT_GRAMS = 100;

/** A library recipe as a one-serving plan item (values divided by the recipe's servings). */
export function recipeToItem(recipe: RecipeSummaryDto): LibraryItem {
  const macros = perServing(recipe.totalNutrients, recipe.servings);
  return {
    type: 'recipe',
    recipe: {
      recipeId: recipe.recipeId ?? '',
      recipeName: recipe.name ?? '',
      nutrientValuePerServing: {
        kcal: macros.kcal,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        fiber: macros.fiber,
      },
      servings: 1,
      foodCategories: recipe.foodCategories,
    },
  };
}

/** A library ingredient as a plan item, in its first common serving (100 g when it has none). */
export function foodToItem(food: FoodSummary): LibraryItem {
  const amountGrams = food.commonServings?.[0]?.weightGrams ?? DEFAULT_AMOUNT_GRAMS;
  return {
    type: 'food',
    food: {
      foodExternalId: food.foodId ?? '',
      foodName: food.rawName ?? food.name ?? '',
      foodNameCs: food.nameCs,
      foodNameEn: food.nameEn,
      foodNameDe: food.nameDe,
      foodCategory: food.category,
      nutrientValuePer100Grams: { ...food.nutrientValue },
      amountGrams: amountGrams > 0 ? amountGrams : DEFAULT_AMOUNT_GRAMS,
    },
  };
}

/** The ingredient's name in the UI language, falling back to the stored name. */
export function foodDisplayName(food: EditorFood, language: string): string {
  const localized =
    language.startsWith('cs') ? food.foodNameCs : language.startsWith('de') ? food.foodNameDe : food.foodNameEn;
  return localized || food.foodName;
}

/** The label of a meal's first item, with the rest as a count, for a grid cell. */
export function mealItemNames(meal: EditorMeal, language: string): string[] {
  return [
    ...meal.recipes.map((recipe) => recipe.recipeName),
    ...meal.foods.map((food) => foodDisplayName(food, language)),
  ];
}
