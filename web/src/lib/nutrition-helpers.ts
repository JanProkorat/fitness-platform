/** Resolve localized food name based on current language */
export function resolveLocalizedName(
  food: {
    foodName: string;
    foodNameCs?: string | null;
    foodNameEn?: string | null;
    foodNameDe?: string | null;
  },
  lang: string,
): string {
  if (lang.startsWith('cs') && food.foodNameCs) return food.foodNameCs;
  if (lang.startsWith('de') && food.foodNameDe) return food.foodNameDe;
  if (lang.startsWith('en') && food.foodNameEn) return food.foodNameEn;
  return food.foodName;
}
