/** Recipe visibility — Public is visible to all nutritionists, Private only to the owner. */
export type RecipeVisibility = 'Public' | 'Private';

/** Summary for recipe list views. */
export interface RecipeSummary {
  recipeId: string;
  name: string;
  foodCount: number;
  prepTimeMinutes?: number | null;
  totalNutrients: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  dateCreated: string;
  foodCategories?: string[];
  visibility?: RecipeVisibility;
  isOwnedByCurrentUser?: boolean;
  /** Main recipe image URL in blob storage, or null if none. */
  imageUrl?: string | null;
}

/** Full recipe detail. */
export interface RecipeDetail {
  recipeId: string;
  name: string;
  description?: string;
  prepTimeMinutes?: number | null;
  steps?: string[] | null;
  note?: string | null;
  foods: {
    foodExternalId: string;
    foodName: string;
    nutrientValuePer100Grams: {
      kcal: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber?: number | null;
      sugar?: number | null;
      saturatedFat?: number | null;
      salt?: number | null;
    };
    amountGrams: number;
    note?: string | null;
  }[];
  totalNutrients: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  /** Main image URL in blob storage, or null if none. */
  imageUrl?: string | null;
  /** Gallery image URLs, up to 6 entries. */
  galleryImageUrls?: string[];
  dateCreated: string;
  dateUpdated?: string | null;
  visibility?: RecipeVisibility;
  isOwnedByCurrentUser?: boolean;
}

/** Request to generate a pre-signed upload URL for a recipe image. */
export interface UploadRecipeImageUrlRequest {
  contentType: string;
  sizeBytes: number;
}

/** Response with the pre-signed URL and final blob URL. */
export interface UploadRecipeImageUrlResponse {
  uploadUrl: string;
  blobUrl: string;
}

/** Request to confirm a recipe image upload by its blob URL. */
export interface ConfirmRecipeImageRequest {
  blobUrl: string;
}

/** Slot for recipe image upload: 'main' overwrites hero; 'gallery' appends (max 6). */
export type RecipeImageSlot = 'main' | 'gallery';

/** Paginated recipe search response. */
export interface SearchRecipesResponse {
  recipes: RecipeSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** Food item in create/update recipe request. */
export interface RecipeFoodInput {
  foodExternalId: string;
  amountGrams: number;
  note?: string | null;
}

/** Request to create a recipe. */
export interface CreateRecipeRequest {
  name: string;
  description?: string;
  prepTimeMinutes?: number | null;
  steps?: string[] | null;
  note?: string | null;
  foods: RecipeFoodInput[];
  visibility?: RecipeVisibility;
}

/** Request to update a recipe. */
export interface UpdateRecipeRequest {
  name: string;
  description?: string;
  prepTimeMinutes?: number | null;
  steps?: string[] | null;
  note?: string | null;
  foods: RecipeFoodInput[];
  visibility?: RecipeVisibility;
}
