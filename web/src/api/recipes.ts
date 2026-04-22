import api from '@/lib/api';
import type {
  RecipeDetail,
  SearchRecipesResponse,
  CreateRecipeRequest,
  UpdateRecipeRequest,
  UploadRecipeImageUrlRequest,
  UploadRecipeImageUrlResponse,
  ConfirmRecipeImageRequest,
  RecipeImageSlot,
} from './recipe-types';

/** Search recipes with pagination. */
export async function searchRecipes(params: {
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<SearchRecipesResponse> {
  const { data } = await api.get<SearchRecipesResponse>('/recipes', { params });
  return data;
}

/** Get a single recipe by ID. */
export async function getRecipe(recipeId: string): Promise<RecipeDetail> {
  const { data } = await api.get<RecipeDetail>(`/recipes/${recipeId}`);
  return data;
}

/** Create a new recipe. */
export async function createRecipe(request: CreateRecipeRequest): Promise<RecipeDetail> {
  const { data } = await api.post<RecipeDetail>('/recipes', request);
  return data;
}

/** Update an existing recipe. */
export async function updateRecipe(
  recipeId: string,
  request: UpdateRecipeRequest,
): Promise<RecipeDetail> {
  const { data } = await api.put<RecipeDetail>(`/recipes/${recipeId}`, request);
  return data;
}

/** Delete a recipe. */
export async function deleteRecipe(recipeId: string): Promise<void> {
  await api.delete(`/recipes/${recipeId}`);
}

/**
 * Request a pre-signed upload URL for a recipe image.
 * slot=main overwrites the hero image; slot=gallery appends to the gallery (max 6).
 */
export async function requestRecipeImageUploadUrl(
  recipeId: string,
  slot: RecipeImageSlot,
  request: UploadRecipeImageUrlRequest,
): Promise<UploadRecipeImageUrlResponse> {
  const { data } = await api.post<UploadRecipeImageUrlResponse>(
    `/recipes/${recipeId}/image/upload-url`,
    request,
    { params: { slot } },
  );
  return data;
}

/**
 * Confirm a recipe image upload after a successful blob PUT.
 * slot=main sets the main imageUrl; slot=gallery appends to galleryImageUrls.
 */
export async function confirmRecipeImage(
  recipeId: string,
  slot: RecipeImageSlot,
  request: ConfirmRecipeImageRequest,
): Promise<void> {
  await api.put(`/recipes/${recipeId}/image`, request, { params: { slot } });
}
