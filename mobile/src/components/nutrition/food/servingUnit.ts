import type { TFunction } from 'i18next';

// Mirrors ServingUnits.cs on the backend (and the same list in the web IngredientDrawer).
export const SERVING_UNIT_KEYS = [
  'portion',
  'piece',
  'slice',
  'cup',
  'tbsp',
  'tsp',
  'handful',
  'glass',
  'pack',
  'can',
  'tub',
  'head',
  'clove',
  'bunch',
  'scoop',
] as const;

export type ServingUnitKey = (typeof SERVING_UNIT_KEYS)[number];

function isServingUnitKey(label: string): label is ServingUnitKey {
  return (SERVING_UNIT_KEYS as readonly string[]).includes(label);
}

/** Translated unit for a known serving key; legacy free-text labels pass through unchanged. */
export function servingUnitLabel(t: TFunction, label: string): string {
  return isServingUnitKey(label) ? t(`nutritionFood.units.${label}`) : label;
}
