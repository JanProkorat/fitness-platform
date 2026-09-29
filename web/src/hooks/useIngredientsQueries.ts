import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { searchFoods, getFoodTags, createFood, updateFood, deleteFood } from '@/api/foods';
import type { CreateFoodRequest, UpdateFoodRequest } from '@/api/food-types';
import { getErrorCode, showApiError, showSuccess } from '@/lib/api-errors';
import type { IngredientListFilters } from '@/hooks/useIngredientListParams';

/**
 * The ingredients (foods) list, filtered/paginated per `filters`. Mirrors
 * `useClients` (`@/hooks/useClientsQueries.ts`) — `tagsKey` is a stable,
 * sorted primitive so re-picking the same tags in a different click order
 * hits one cache entry instead of two.
 */
export function useIngredients(filters: IngredientListFilters) {
  const tagsKey = [...filters.tags].sort().join(',');
  const categoriesKey = [...filters.categories].sort().join(',');

  return useQuery({
    queryKey: [
      'ingredients',
      'list',
      {
        search: filters.search,
        categoriesKey,
        tagsKey,
        page: filters.page,
        pageSize: filters.pageSize,
      },
    ],
    queryFn: () =>
      searchFoods({
        q: filters.search || undefined,
        categories: filters.categories,
        tags: filters.tags,
        page: filters.page,
        pageSize: filters.pageSize,
      }),
    placeholderData: keepPreviousData,
  });
}

/** Distinct tags across every food visible to the caller — powers the Tags
 * filter pill and the drawer's tag suggestions. */
export function useFoodTags() {
  return useQuery({
    queryKey: ['ingredients', 'tags'],
    queryFn: getFoodTags,
  });
}

/** Creates a coach-owned food (Nutritionist only). Defaults to Private visibility. */
export function useCreateFood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateFoodRequest) => createFood(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      showSuccess('ingredients.drawer.createSuccess');
    },
    onError: (error) => {
      // KCAL_INCONSISTENT is shown inline under the Calories field by the
      // drawer's own per-call onError (IngredientDrawer.tsx) — toasting it
      // here too would show the same message twice. Every other error
      // still gets the toast.
      if (getErrorCode(error) === 'KCAL_INCONSISTENT') {
        return;
      }
      showApiError(error, 'ingredients.drawer.createError');
    },
  });
}

export interface UpdateFoodVariables {
  foodId: string;
  request: UpdateFoodRequest;
}

/** Updates a coach-owned food (owner only). Full-state PUT — see `updateFood`'s doc comment. */
export function useUpdateFood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: UpdateFoodVariables) => updateFood(variables.foodId, variables.request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      showSuccess('ingredients.drawer.updateSuccess');
    },
    onError: (error) => {
      // Same reasoning as useCreateFood's onError above — the drawer's own
      // per-call onError already shows KCAL_INCONSISTENT inline.
      if (getErrorCode(error) === 'KCAL_INCONSISTENT') {
        return;
      }
      showApiError(error, 'ingredients.drawer.updateError');
    },
  });
}

/** Soft-deletes a coach-owned food (owner only). */
export function useDeleteFood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (foodId: string) => deleteFood(foodId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      showSuccess('ingredients.deleteSuccess');
    },
    onError: (error) => {
      showApiError(error, 'ingredients.deleteError');
    },
  });
}
