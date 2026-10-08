import { PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom';
import type { FoodSummary, RecipeSummaryDto } from '@/api/generated';
import type { EditorFood, EditorMeal, LibraryItem } from '@/components/plan-editor/plan-editor-types';
import { perServing } from '@/lib/recipe-nutrition';

const DEFAULT_AMOUNT_GRAMS = 100;

/** `data.type` of a week-grid cell's drag; the Day view's reorder drags use `'meal'` instead. */
export const CELL_MEAL_DRAG = 'cell-meal';

export interface CellMealDrag {
  weekIndex: number;
  dayOfWeek: number;
  rowIndex: number;
  mealId: string;
}

/** The source of a week-grid card drag, or null for any other drag. */
export function readCellMealDrag(data: unknown): CellMealDrag | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const { type, weekIndex, dayOfWeek, rowIndex, mealId } = data as Record<string, unknown>;
  return type === CELL_MEAL_DRAG &&
    typeof weekIndex === 'number' &&
    typeof dayOfWeek === 'number' &&
    typeof rowIndex === 'number' &&
    typeof mealId === 'string'
    ? { weekIndex, dayOfWeek, rowIndex, mealId }
    : null;
}

/** `data.type` of a recipe or ingredient row dragged within its own list of a meal. */
export const MEAL_ITEM_DRAG = 'meal-item';

export interface MealItemDrag {
  weekIndex: number;
  dayOfWeek: number;
  mealId: string;
  kind: 'recipe' | 'food';
  index: number;
}

/** The source of a meal-item reorder drag, or null for any other drag. */
export function readMealItemDrag(data: unknown): MealItemDrag | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const { type, weekIndex, dayOfWeek, mealId, kind, index } = data as Record<string, unknown>;
  return type === MEAL_ITEM_DRAG &&
    typeof weekIndex === 'number' &&
    typeof dayOfWeek === 'number' &&
    typeof mealId === 'string' &&
    (kind === 'recipe' || kind === 'food') &&
    typeof index === 'number'
    ? { weekIndex, dayOfWeek, mealId, kind, index }
    : null;
}

/** Whole-card drags: a short mouse move starts one, touch needs a press so the list still scrolls. */
export function dragActivationConstraints(event: PointerEvent) {
  return event.pointerType === 'touch'
    ? [new PointerActivationConstraints.Delay({ value: 250, tolerance: 5 })]
    : [new PointerActivationConstraints.Distance({ value: 5 })];
}

/** Day-view meal cards: the whole card drags, but inputs, buttons and `data-no-drag` parts do not start one. */
export const MEAL_CARD_SENSORS = [
  PointerSensor.configure({
    activationConstraints: dragActivationConstraints,
    preventActivation: (event) =>
      event.target instanceof Element &&
      event.target.closest('input, textarea, select, button, a, [data-no-drag]') !== null,
  }),
];

/** Library cards: the whole card drags, except children marked `data-no-drag` (the add button). */
export const LIBRARY_CARD_SENSORS = [
  PointerSensor.configure({
    activationConstraints: dragActivationConstraints,
    preventActivation: (event) => event.target instanceof Element && event.target.closest('[data-no-drag]') !== null,
  }),
];

/**
 * Week-grid cells: pointer only, so Enter and Space on a focused cell keep opening the meal. The cell
 * is itself a button, so a press on its text must not count as one on an interactive child.
 */
export const GRID_CELL_SENSORS = [
  PointerSensor.configure({ activationConstraints: dragActivationConstraints, preventActivation: () => false }),
];

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
