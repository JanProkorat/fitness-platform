/**
 * Convenience re-exports of the generated food-related API types, plus a
 * couple of thin aliases used across the Ingredients page.
 *
 * Kept as a sibling module (never edit `generated.ts` directly — it is
 * write-locked, see `rules/code-style.md#generated-files-are-write-locked-if-the-repo-has-one`).
 */
export {
  FoodCategory,
  FoodVisibility,
  Allergen,
  DietaryPreference,
} from './generated';

export type {
  FoodSummary,
  FoodTagDto,
  NutrientValueDto,
  ServingSizeDto,
  SearchFoodsResponse,
  CreateFoodRequest,
  UpdateFoodRequest,
} from './generated';
