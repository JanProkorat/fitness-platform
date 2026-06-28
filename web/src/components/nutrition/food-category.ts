export const CATEGORY_ICONS: Record<string, string> = {
  Fruit: '🍎',
  Vegetables: '🥦',
  Meat: '🥩',
  FishAndSeafood: '🐟',
  Dairy: '🥛',
  GrainsAndCereals: '🌾',
  Legumes: '🫘',
  NutsAndSeeds: '🥜',
  OilsAndFats: '🫒',
  SweetsAndSnacks: '🍫',
  Beverages: '🥤',
  Supplements: '💊',
  Other: '🍽️',
};

/** CSS-variable based colors for UI components */
export const CATEGORY_CSS_COLORS: Record<string, { color: string; bg: string }> = {
  Fruit: { color: 'var(--green)', bg: 'var(--green-bg)' },
  Vegetables: { color: 'var(--green)', bg: 'var(--green-bg)' },
  Meat: { color: 'var(--red)', bg: 'var(--red-bg)' },
  FishAndSeafood: { color: 'var(--blue)', bg: 'var(--blue-bg)' },
  Dairy: { color: 'var(--purple)', bg: 'var(--purple-bg)' },
  GrainsAndCereals: { color: 'var(--orange)', bg: 'var(--orange-bg)' },
  Legumes: { color: 'var(--green)', bg: 'var(--green-bg)' },
  NutsAndSeeds: { color: 'var(--orange)', bg: 'var(--orange-bg)' },
  OilsAndFats: { color: 'var(--purple)', bg: 'var(--purple-bg)' },
  SweetsAndSnacks: { color: 'var(--red)', bg: 'var(--red-bg)' },
  Beverages: { color: 'var(--blue)', bg: 'var(--blue-bg)' },
  Supplements: { color: 'var(--accent)', bg: 'var(--accent-bg)' },
  Other: { color: 'var(--text3)', bg: 'var(--bg3)' },
};

export const FOOD_CATEGORIES = [
  'Other', 'Fruit', 'Vegetables', 'Meat', 'FishAndSeafood', 'Dairy',
  'GrainsAndCereals', 'Legumes', 'NutsAndSeeds', 'OilsAndFats',
  'SweetsAndSnacks', 'Beverages', 'Supplements',
] as const;

export const ALL_CATEGORIES = [
  'Fruit', 'Vegetables', 'Meat', 'FishAndSeafood', 'Dairy', 'GrainsAndCereals',
  'Legumes', 'NutsAndSeeds', 'OilsAndFats', 'SweetsAndSnacks', 'Beverages', 'Supplements', 'Other',
] as const;
