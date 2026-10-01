/**
 * Recipes API module — wraps the NSwag-generated recipe endpoints.
 */
import { apiClient } from '@/api/client';
import type {
  ConfirmRecipeImageRequest,
  CreateRecipeRequest,
  DietaryPreference,
  FoodOwnerFilter,
  FoodSortDirection,
  GetRecipeResponse,
  RecipeMealType,
  RecipeSortField,
  RecipeSummaryDto,
  UpdateRecipeRequest,
  UploadRecipeImageUrlRequest,
} from '@/api/generated';

/** Slot for recipe image upload: 'main' overwrites hero; 'gallery' appends (max 6). */
export type RecipeImageSlot = 'main' | 'gallery';

export interface SearchRecipesParams {
  search?: string;
  /** Matches a recipe suited for ANY of the supplied meal types. */
  mealTypes: RecipeMealType[];
  /** Matches a recipe carrying ALL of the supplied dietary preferences. */
  dietaryPreferences: DietaryPreference[];
  /** Matches a recipe whose ownership falls under ANY of the supplied values. */
  owners: FoodOwnerFilter[];
  page: number;
  pageSize: number;
  /** `undefined` means the server default: newest-created first. */
  sortBy?: RecipeSortField;
  sortDir?: FoodSortDirection;
}

export interface SearchRecipesResult {
  recipes: RecipeSummaryDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** Search recipes by name/description, meal type, dietary preference and owner. */
export async function searchRecipes(params: SearchRecipesParams): Promise<SearchRecipesResult> {
  // NSwag orders array params ahead of scalar ones — re-check this argument
  // order against the generated `searchRecipesEndpoint` signature on regen.
  const response = await apiClient.searchRecipesEndpoint(
    params.mealTypes,
    params.dietaryPreferences,
    params.owners,
    params.page,
    params.pageSize,
    params.search,
    params.sortBy,
    params.sortDir,
  );
  return {
    recipes: response.recipes ?? [],
    totalCount: response.totalCount ?? 0,
    page: response.page ?? params.page,
    pageSize: response.pageSize ?? params.pageSize,
  };
}

/** Get a single recipe's full detail. */
export async function getRecipe(recipeId: string): Promise<GetRecipeResponse> {
  return apiClient.getRecipeEndpoint(recipeId);
}

/** Create a recipe (Nutritionist only). Private by default. */
export async function createRecipe(request: CreateRecipeRequest): Promise<GetRecipeResponse> {
  return apiClient.createRecipeEndpoint(request);
}

/** Update a recipe (owner only). Full-state PUT; `version` must echo the loaded value. */
export async function updateRecipe(recipeId: string, request: UpdateRecipeRequest): Promise<GetRecipeResponse> {
  return apiClient.updateRecipeEndpoint(recipeId, request);
}

/** Delete a recipe (owner only). */
export async function deleteRecipe(recipeId: string): Promise<void> {
  await apiClient.deleteRecipeEndpoint(recipeId);
}

/** Request a pre-signed upload URL for a recipe image (owner only). */
export async function requestRecipeImageUploadUrl(
  recipeId: string,
  slot: RecipeImageSlot,
  request: UploadRecipeImageUrlRequest,
): Promise<{ uploadUrl: string; blobUrl: string }> {
  const response = await apiClient.uploadRecipeImageUrlEndpoint(recipeId, slot, request);
  return { uploadUrl: response.uploadUrl ?? '', blobUrl: response.blobUrl ?? '' };
}

/** Confirm a completed recipe image upload by persisting its blob URL (owner only). */
export async function confirmRecipeImage(recipeId: string, slot: RecipeImageSlot, blobUrl: string): Promise<void> {
  const body: ConfirmRecipeImageRequest = { blobUrl };
  await apiClient.confirmRecipeImageEndpoint(recipeId, slot, body);
}

/** Clears a recipe's main picture (owner only). */
export async function removeRecipeImage(recipeId: string): Promise<void> {
  await apiClient.deleteRecipeImageEndpoint(recipeId);
}
