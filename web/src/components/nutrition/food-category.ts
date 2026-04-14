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

export const CATEGORY_COLORS: Record<string, string> = {
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
