/**
 * Shared caps for the ingredient drawer's tag editor — mirrors
 * CreateFoodValidator/UpdateFoodValidator's own caps (#1115 code review).
 * Single source of truth for both `TagsInput`'s own client-side refusal and
 * `IngredientDrawer`'s zod safety net for legacy data already over the
 * limit — kept in one file so the two can't drift apart.
 */
export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 40;
