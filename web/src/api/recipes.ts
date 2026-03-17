import api from '@/lib/api';
import type {
  RecipeDetail,
  SearchRecipesResponse,
  CreateRecipeRequest,
  UpdateRecipeRequest,
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
