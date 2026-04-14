import type { FoodSummary } from '@/api/food-types';
import type { RecipeSummary } from '@/api/recipe-types';
import type { MealFood } from '@/api/plan-types';
import type { StagedRecipe } from './AddItemsDrawer-types';

export function foodToMealFood(food: FoodSummary): MealFood {
  return {
    foodExternalId: food.foodId,
    foodName: food.name,
    nutrientValuePer100Grams: {
      kcal: food.nutrientValue.kcal,
      protein: food.nutrientValue.protein,
      carbs: food.nutrientValue.carbs,
      fat: food.nutrientValue.fat,
      fiber: food.nutrientValue.fiber,
      sugar: food.nutrientValue.sugar,
      saturatedFat: food.nutrientValue.saturatedFat,
      salt: food.nutrientValue.salt,
    },
    amountGrams: 100,
  };
}

export function expandRecipesIntoFoods(stagedRecipes: StagedRecipe[]): MealFood[] {
  return stagedRecipes.flatMap((sr) =>
    sr.recipe.foods.map((f) => ({
      foodExternalId: f.foodExternalId,
      foodName: f.foodName,
      nutrientValuePer100Grams: {
        kcal: f.nutrientValuePer100Grams.kcal,
        protein: f.nutrientValuePer100Grams.protein,
        carbs: f.nutrientValuePer100Grams.carbs,
        fat: f.nutrientValuePer100Grams.fat,
        fiber: f.nutrientValuePer100Grams.fiber,
        sugar: f.nutrientValuePer100Grams.sugar,
        saturatedFat: f.nutrientValuePer100Grams.saturatedFat,
        salt: f.nutrientValuePer100Grams.salt,
      },
      amountGrams: Math.round(f.amountGrams * sr.portions),
    })),
  );
}

export function isFoodAlreadyStaged(food: FoodSummary, staged: MealFood[]): boolean {
  return staged.some((s) => s.foodExternalId === food.foodId);
}

export function isRecipeAlreadyStaged(recipe: RecipeSummary, stagedRecipes: StagedRecipe[]): boolean {
  return stagedRecipes.some((s) => s.recipe.recipeId === recipe.recipeId);
}
