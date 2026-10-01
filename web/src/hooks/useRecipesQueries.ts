import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  searchRecipes,
  getRecipe,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  requestRecipeImageUploadUrl,
  confirmRecipeImage,
  removeRecipeImage,
} from '@/api/recipes';
import { searchFoods } from '@/api/foods';
import type { CreateRecipeRequest, UpdateRecipeRequest, UploadRecipeImageUrlRequest } from '@/api/recipe-types';
import { getErrorStatus, showApiError, showSuccess } from '@/lib/api-errors';
import { bumpImageVersion } from '@/hooks/useImageVersion';
import { FoodSortDirection, FoodSortField } from '@/api/food-types';
import type { RecipeListFilters } from '@/hooks/useRecipeListParams';

export function recipeImageCacheKey(recipeId: string): string {
  return `recipe:${recipeId}`;
}

/** A 403 is a role gate (trainer-only coach), not a transient failure — never retried. */
function retryUnlessForbidden(failureCount: number, error: unknown): boolean {
  return getErrorStatus(error) !== 403 && failureCount < 1;
}

/** The recipes list, filtered/sorted/paginated per `filters`. */
export function useRecipes(filters: RecipeListFilters, enabled: boolean) {
  const mealTypesKey = [...filters.mealTypes].sort().join(',');
  const dietKey = [...filters.dietaryPreferences].sort().join(',');
  const ownersKey = [...filters.owners].sort().join(',');

  return useQuery({
    queryKey: [
      'recipes',
      'list',
      {
        search: filters.search,
        mealTypesKey,
        dietKey,
        ownersKey,
        sortBy: filters.sortBy,
        sortDir: filters.sortDir,
        page: filters.page,
        pageSize: filters.pageSize,
      },
    ],
    queryFn: () =>
      searchRecipes({
        search: filters.search || undefined,
        mealTypes: filters.mealTypes,
        dietaryPreferences: filters.dietaryPreferences,
        owners: filters.owners,
        page: filters.page,
        pageSize: filters.pageSize,
        sortBy: filters.sortBy ?? undefined,
        sortDir: filters.sortBy ? filters.sortDir : undefined,
      }),
    placeholderData: keepPreviousData,
    enabled,
    retry: retryUnlessForbidden,
  });
}

/** One recipe's full detail — loaded when the drawer opens an existing row. */
export function useRecipe(recipeId: string | undefined) {
  return useQuery({
    queryKey: ['recipes', 'detail', recipeId],
    queryFn: () => getRecipe(recipeId as string),
    enabled: Boolean(recipeId),
    // The drawer edits a snapshot, so a background refetch must not swap it
    // out from under the form; the drawer re-reads on each open instead.
    staleTime: 0,
    gcTime: 0,
  });
}

/** Ingredient (food) search backing the recipe drawer's Ingredients tab — own + public + system foods. */
export function useIngredientSearch(term: string) {
  return useQuery({
    queryKey: ['recipes', 'foodSearch', term],
    queryFn: () =>
      searchFoods({
        q: term,
        categories: [],
        tagIds: [],
        owners: [],
        page: 1,
        pageSize: 8,
        sortBy: FoodSortField.Name,
        sortDir: FoodSortDirection.Ascending,
      }),
    enabled: term.trim().length > 0,
    placeholderData: keepPreviousData,
  });
}

/** Creates a recipe. The drawer shows the success/error toasts via this hook. */
export function useCreateRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateRecipeRequest) => createRecipe(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      showSuccess('recipes.drawer.createSuccess');
    },
    onError: (error) => {
      showApiError(error, 'recipes.drawer.createError');
    },
  });
}

export interface UpdateRecipeVariables {
  recipeId: string;
  request: UpdateRecipeRequest;
}

/** Updates a recipe (owner only). Full-state PUT carrying the loaded `version`. */
export function useUpdateRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: UpdateRecipeVariables) => updateRecipe(variables.recipeId, variables.request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      showSuccess('recipes.drawer.updateSuccess');
    },
    onError: (error) => {
      showApiError(error, 'recipes.drawer.updateError');
    },
  });
}

/** Deletes a recipe (owner only). */
export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recipeId: string) => deleteRecipe(recipeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      showSuccess('recipes.deleteSuccess');
    },
    onError: (error) => {
      showApiError(error, 'recipes.deleteError');
    },
  });
}

/** Requests a pre-signed upload URL for a recipe's main picture (owner only). */
export function useRequestRecipeImageUploadUrl() {
  return useMutation({
    mutationFn: (variables: { recipeId: string; request: UploadRecipeImageUrlRequest }) =>
      requestRecipeImageUploadUrl(variables.recipeId, 'main', variables.request),
  });
}

/** Confirms a completed main-picture upload; bumps the cache-buster and refreshes lists. */
export function useConfirmRecipeImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { recipeId: string; blobUrl: string }) =>
      confirmRecipeImage(variables.recipeId, 'main', variables.blobUrl),
    onSuccess: (_data, variables) => {
      bumpImageVersion(queryClient, recipeImageCacheKey(variables.recipeId));
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}

/** Removes a recipe's main picture (owner only). */
export function useRemoveRecipeImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recipeId: string) => removeRecipeImage(recipeId),
    onSuccess: (_data, recipeId) => {
      bumpImageVersion(queryClient, recipeImageCacheKey(recipeId));
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      showSuccess('library.picture.removeSuccess');
    },
    onError: (error) => {
      showApiError(error, 'library.picture.removeError');
    },
  });
}
