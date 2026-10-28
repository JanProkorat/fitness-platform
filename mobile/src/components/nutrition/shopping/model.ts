import { FoodCategory } from '@/api/generated';
import { foodName } from '@/components/nutrition/meal/format';
import type { ShoppingListData, ShoppingListEntry } from '@/api/nutrition';

/** Section order of the list; every category the API can send has its own section. */
export const CATEGORY_ORDER: readonly FoodCategory[] = [
  FoodCategory.Vegetables,
  FoodCategory.Fruit,
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

/** The category of an item; a name the app does not know falls into Other. */
export function categoryOf(item: ShoppingListEntry): FoodCategory {
  return CATEGORY_ORDER.find((category) => category === item.foodCategory) ?? FoodCategory.Other;
}

export type ShoppingSection = { category: FoodCategory; items: ShoppingListEntry[] };

/** Non-empty sections in the fixed category order, items sorted by name. */
export function groupByCategory(items: readonly ShoppingListEntry[], language: string): ShoppingSection[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    items: items
      .filter((item) => categoryOf(item) === category)
      .sort((first, second) => foodName(first, language).localeCompare(foodName(second, language), language)),
  })).filter((section) => section.items.length > 0);
}

/** Items that carry an id, the only ones that can be ticked. */
export const tickableItems = (data: ShoppingListData | undefined): ShoppingListEntry[] =>
  (data?.items ?? []).filter((item) => typeof item.foodExternalId === 'string');

export const boughtCount = (items: readonly ShoppingListEntry[]): number =>
  items.filter((item) => item.isTicked === true).length;

/** List with one item ticked or unticked, used for the optimistic update. */
export function withItemTicked(
  data: ShoppingListData | undefined,
  foodExternalId: string,
  isTicked: boolean,
): ShoppingListData | undefined {
  if (!data) return data;
  return {
    ...data,
    items: (data.items ?? []).map((item) => (item.foodExternalId === foodExternalId ? { ...item, isTicked } : item)),
  };
}

export type Quantity = { unit: 'g' | 'kg'; value: string };

/** Grams up to 999, then kilograms with at most two decimals, formatted in the app language. */
export function quantityOf(language: string, grams: number | undefined): Quantity {
  const amount = grams ?? 0;
  if (amount >= 1000) {
    return {
      unit: 'kg',
      value: new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(amount / 1000),
    };
  }
  return { unit: 'g', value: new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(amount) };
}

type ShareTextOptions = {
  title: string;
  subtitle: string;
  sections: readonly ShoppingSection[];
  categoryLabel: (category: FoodCategory) => string;
  quantityLabel: (item: ShoppingListEntry) => string;
  language: string;
};

/** Plain-text list for the share sheet: title, week, then items grouped by category with amounts. */
export function buildShareText({
  title,
  subtitle,
  sections,
  categoryLabel,
  quantityLabel,
  language,
}: ShareTextOptions): string {
  const blocks = sections.map((section) =>
    [
      categoryLabel(section.category),
      ...section.items.map((item) => `- ${foodName(item, language)}: ${quantityLabel(item)}`),
    ].join('\n'),
  );
  return [[title, subtitle].join('\n'), ...blocks].join('\n\n');
}
