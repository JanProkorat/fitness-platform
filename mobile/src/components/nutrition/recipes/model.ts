import type { ClientRecipeListItem } from '@/api/generated';
import { MealKind } from '@/api/generated';

export type RecipeChip = 'all' | 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const RECIPE_CHIPS: readonly RecipeChip[] = ['all', 'breakfast', 'lunch', 'dinner', 'snack'];

/** Planned meal kinds each chip stands for; pre- and post-workout recipes only appear under "all". */
const CHIP_KINDS: Record<Exclude<RecipeChip, 'all'>, readonly MealKind[]> = {
  breakfast: [MealKind.Breakfast],
  lunch: [MealKind.Lunch],
  dinner: [MealKind.Dinner],
  snack: [MealKind.MorningSnack, MealKind.AfternoonSnack],
};

const normalize = (value: string): string => value.trim().toLocaleLowerCase();

/** Applies the meal-kind chip and the name search to the loaded list. */
export function filterRecipes(
  items: readonly ClientRecipeListItem[],
  chip: RecipeChip,
  query: string,
): ClientRecipeListItem[] {
  const needle = normalize(query);
  return items.filter((item) => {
    if (chip !== 'all') {
      const kinds = CHIP_KINDS[chip];
      if (!(item.mealKinds ?? []).some((kind) => kinds.includes(kind))) return false;
    }
    return needle === '' || normalize(item.name ?? '').includes(needle);
  });
}

export type RecipeGroup = {
  planId: string;
  planName: string;
  nutritionistName: string;
  startDate: string | undefined;
  endDate: string | undefined;
  isCurrentPlan: boolean;
  items: ClientRecipeListItem[];
};

/** Groups by plan in the order the server sent them (newest plan first). */
export function groupByPlan(items: readonly ClientRecipeListItem[]): RecipeGroup[] {
  const groups = new Map<string, RecipeGroup>();
  for (const item of items) {
    const planId = item.planId ?? '';
    const existing = groups.get(planId);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(planId, {
        planId,
        planName: item.planName ?? '',
        nutritionistName: item.nutritionistName ?? '',
        startDate: item.startDate,
        endDate: item.endDate,
        isCurrentPlan: item.isCurrentPlan === true,
        items: [item],
      });
    }
  }
  return [...groups.values()];
}

export type RecipeRow =
  | { type: 'header'; key: string; group: RecipeGroup }
  | { type: 'pair'; key: string; items: readonly [ClientRecipeListItem, ClientRecipeListItem | undefined] };

/** Flattens items (optionally under plan headers) into rows of two cards for a single-column list. */
export function toRows(items: readonly ClientRecipeListItem[], grouped: boolean): RecipeRow[] {
  const rows: RecipeRow[] = [];
  const pushPairs = (list: readonly ClientRecipeListItem[], prefix: string) => {
    for (let index = 0; index < list.length; index += 2) {
      const first = list[index];
      if (!first) continue;
      rows.push({ type: 'pair', key: `${prefix}-${index}`, items: [first, list[index + 1]] });
    }
  };
  if (!grouped) {
    pushPairs(items, 'recipes');
    return rows;
  }
  for (const group of groupByPlan(items)) {
    rows.push({ type: 'header', key: `header-${group.planId}`, group });
    pushPairs(group.items, group.planId);
  }
  return rows;
}

export const recipeKey = (item: ClientRecipeListItem): string => `${item.planId ?? ''}:${item.recipeId ?? ''}`;

/** The kind a card is labelled with: the first planned meal kind. */
export const primaryKind = (item: ClientRecipeListItem): MealKind | undefined => item.mealKinds?.[0];
