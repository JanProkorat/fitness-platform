import { createContext } from 'react';
import { FoodCategory } from '@/api/food-types';
import { DietaryStyle, PrimaryGoal } from '@/api/generated';
import type { RankedLists, RankedTemplate } from '@/components/client-plan-editor/templateMatching';
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

export interface TemplateFilterState {
  goals: PrimaryGoal[];
  dietaryStyles: DietaryStyle[];
  /** Kcal per day bounds as typed; blank means no bound on that side. */
  minKcal: string;
  maxKcal: string;
}

export const EMPTY_TEMPLATE_FILTERS: TemplateFilterState = { goals: [], dietaryStyles: [], minKcal: '', maxKcal: '' };
export const PRIMARY_GOALS = Object.values(PrimaryGoal);
export const DIETARY_STYLES = Object.values(DietaryStyle);

function parseKcalBound(value: string): number | undefined {
  const parsed = value.trim() === '' ? Number.NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** The kcal range counts as one filter, whichever of its sides is set. */
export function countTemplateFilters(filters: TemplateFilterState): number {
  const hasKcal = parseKcalBound(filters.minKcal) !== undefined || parseKcalBound(filters.maxKcal) !== undefined;
  return filters.goals.length + filters.dietaryStyles.length + (hasKcal ? 1 : 0);
}

function matchesTemplateFilters({ template }: RankedTemplate, filters: TemplateFilterState): boolean {
  if (filters.goals.length > 0 && (!template.goal || !filters.goals.includes(template.goal))) {
    return false;
  }
  if (filters.dietaryStyles.length > 0 && (!template.dietaryStyle || !filters.dietaryStyles.includes(template.dietaryStyle))) {
    return false;
  }
  const min = parseKcalBound(filters.minKcal);
  const max = parseKcalBound(filters.maxKcal);
  if (min === undefined && max === undefined) {
    return true;
  }
  const kcal = template.avgKcalPerDay;
  if (kcal === undefined || kcal === null) {
    return false;
  }
  return (min === undefined || kcal >= min) && (max === undefined || kcal <= max);
}

/** Drops the templates the filters rule out, keeping the recommended grouping and order of the rest. */
export function filterRankedLists(lists: RankedLists, filters: TemplateFilterState): RankedLists {
  if (countTemplateFilters(filters) === 0) {
    return lists;
  }
  return {
    matched: lists.matched.filter((item) => matchesTemplateFilters(item, filters)),
    others: lists.others.filter((item) => matchesTemplateFilters(item, filters)),
  };
}

/**
 * Search text and filters of the Templates tab. The library panel owns them and provides them here, because
 * the tab unmounts when another tab is picked and its state would be lost.
 */
export interface TemplateTabState {
  searchInput: string;
  setSearchInput: (next: string) => void;
  filters: TemplateFilterState;
  setFilters: (next: TemplateFilterState) => void;
}

export const TemplateTabStateContext = createContext<TemplateTabState | null>(null);
