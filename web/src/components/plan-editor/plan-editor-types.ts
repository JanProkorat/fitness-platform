import type { DietaryStyle, MealKind, NutrientValue, PrimaryGoal } from '@/api/generated';

/** One ingredient in a meal, with the per-100g values snapshotted when it was added. */
export interface EditorFood {
  foodExternalId: string;
  foodName: string;
  foodNameCs?: string;
  foodNameEn?: string;
  foodNameDe?: string;
  foodCategory?: string;
  nutrientValuePer100Grams: NutrientValue;
  amountGrams: number;
  note?: string;
}

/** One recipe in a meal, with the per-serving values snapshotted when it was added. */
export interface EditorRecipe {
  recipeId: string;
  recipeName: string;
  nutrientValuePerServing: NutrientValue;
  servings: number;
  note?: string;
  foodCategories?: string[];
}

export interface EditorMeal {
  mealId: string;
  kind: MealKind;
  /** 1-based position within the day; row N of the grid is the meal with order N. */
  order: number;
  time?: string;
  note?: string;
  foods: EditorFood[];
  recipes: EditorRecipe[];
}

export interface EditorDay {
  /** 1 = Monday ... 7 = Sunday. */
  dayOfWeek: number;
  note?: string;
  meals: EditorMeal[];
}

export interface EditorWeek {
  weekNumber: number;
  days: EditorDay[];
}

/** The part of a plan the editor changes. Everything else stays with the host. */
export interface EditorDocument {
  name: string;
  description?: string;
  goal?: PrimaryGoal;
  dietaryStyle?: DietaryStyle;
  /** Daily targets the days and weeks are measured against. */
  targets: PlanTargets;
  weeks: EditorWeek[];
}

/** Something dragged or added from the library panel. */
export type LibraryItem = { type: 'recipe'; recipe: EditorRecipe } | { type: 'food'; food: EditorFood };

export type SaveStatus = 'idle' | 'saving' | 'error' | 'conflict';

/** Daily targets the host has for the plan; any of them may be unset. */
export interface PlanTargets {
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
}

export type EditorSideTab = 'info' | 'library';
export type EditorRange = 'week' | 'day';
export type EditorView = 'meals' | 'nutrition';

export const MAX_MEALS_PER_DAY = 20;
export const MAX_SERVINGS = 100;
export const MAX_GRAMS = 10000;
export const MAX_NOTE_LENGTH = 500;

export const DAYS_PER_WEEK = 7;
export const MAX_WEEKS = 52;
export const MAX_UNDO_STEPS = 50;
