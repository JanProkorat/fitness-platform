import { FoodCategory } from '@/api/food-types';
import { DietaryPreference, FoodOwnerFilter, RecipeMealType } from '@/api/recipe-types';

export interface RecipeFilterState {
  mealTypes: RecipeMealType[];
  dietaryPreferences: DietaryPreference[];
  owners: FoodOwnerFilter[];
  tags: string[];
}

export interface IngredientFilterState {
  categories: FoodCategory[];
  owners: FoodOwnerFilter[];
  tags: string[];
}

export const EMPTY_RECIPE_FILTERS: RecipeFilterState = { mealTypes: [], dietaryPreferences: [], owners: [], tags: [] };
export const EMPTY_INGREDIENT_FILTERS: IngredientFilterState = { categories: [], owners: [], tags: [] };

/** Same option order as the Owner and Category pills on the Ingredients and Recipes pages. */
export const OWNER_ORDER: readonly FoodOwnerFilter[] = [FoodOwnerFilter.Mine, FoodOwnerFilter.System, FoodOwnerFilter.OtherCoaches];
export const CATEGORY_ORDER: readonly FoodCategory[] = [
  FoodCategory.Fruit,
  FoodCategory.Vegetables,
  FoodCategory.Meat,
  FoodCategory.FishAndSeafood,
  FoodCategory.Dairy,
  FoodCategory.GrainsAndCereals,
  FoodCategory.Legumes,
  FoodCategory.NutsAndSeeds,
  FoodCategory.OilsAndFats,
  FoodCategory.SweetsAndSnacks,
  FoodCategory.Beverages,
  FoodCategory.Supplements,
  FoodCategory.Other,
];
export const MEAL_TYPES = Object.values(RecipeMealType);
export const DIETARY_PREFERENCES = Object.values(DietaryPreference);

export function countRecipeFilters(filters: RecipeFilterState): number {
  return filters.mealTypes.length + filters.dietaryPreferences.length + filters.owners.length + filters.tags.length;
}

export function countIngredientFilters(filters: IngredientFilterState, isNutritionist: boolean): number {
  return filters.categories.length + (isNutritionist ? filters.owners.length + filters.tags.length : 0);
}

export function toggleValue<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}
