export const FOOD_CATEGORY_COLORS: Record<string, string> = {
  Fruit: '#c0392b',
  Vegetables: '#0f7b6c',
  Meat: '#8b5e3c',
  FishAndSeafood: '#0b6e99',
  Dairy: '#9b9a97',
  GrainsAndCereals: '#c9a84c',
  Legumes: '#6d8c54',
  NutsAndSeeds: '#ad5700',
  OilsAndFats: '#7a8b3c',
  SweetsAndSnacks: '#a0522d',
  Beverages: '#2e86ab',
  Supplements: '#6940a5',
  Other: '#9b9a97',
}

export const FOOD_CATEGORY_FALLBACK_COLOR = '#9b9a97'

export const RECIPE_CHIP_COLOR = '#eab308'

export function getFoodCategoryColor(category?: string | null): string {
  if (!category) return FOOD_CATEGORY_FALLBACK_COLOR
  return FOOD_CATEGORY_COLORS[category] ?? FOOD_CATEGORY_FALLBACK_COLOR
}
