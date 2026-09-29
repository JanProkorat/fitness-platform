import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { searchFoods, createFood, updateFood, deleteFood } from '@/api/foods';
import {
  getFoodTags,
  createFoodTag,
  updateFoodTag,
  deleteFoodTag,
  replaceFoodTagAssignments,
  type CreateFoodTagRequest,
  type UpdateFoodTagRequest,
} from '@/api/food-tags';
import type { CreateFoodRequest, UpdateFoodRequest } from '@/api/food-types';
import { getErrorCode, showApiError, showSuccess } from '@/lib/api-errors';
import type { IngredientListFilters } from '@/hooks/useIngredientListParams';

/**
 * The ingredients (foods) list, filtered/paginated per `filters`. Mirrors
 * `useClients` (`@/hooks/useClientsQueries.ts`) — `tagsKey` is a stable,
 * sorted primitive so re-picking the same tags in a different click order
 * hits one cache entry instead of two. `filters.tags` holds food-tag ids
 * (#1120), despite the field's name (kept for the URL param — see
 * `useIngredientListParams`).
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
        tagIds: filters.tags,
        page: filters.page,
        pageSize: filters.pageSize,
      }),
    placeholderData: keepPreviousData,
  });
}

/** The caller's own food tags (#1120) — powers the Tags filter popover, the
 * drawer's tag picker, and the table's per-row chips. Nutritionist-only;
 * a trainer-only coach's caller never mounts this (see `IngredientsPage`). */
export function useFoodTags() {
  return useQuery({
    queryKey: ['foodTags'],
    queryFn: getFoodTags,
  });
}

/**
 * Creates a food tag. No optimistic insert — the server mints the id and
 * enforces per-owner name uniqueness (FOOD_TAG_NAME_ALREADY_EXISTS), which
 * is a real error the user must see, not something to paper over locally.
 */
export function useCreateFoodTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateFoodTagRequest) => createFoodTag(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foodTags'] });
    },
    onError: (error) => {
      showApiError(error, 'ingredients.tags.createError');
    },
  });
}

export interface UpdateFoodTagVariables {
  tagId: string;
  request: UpdateFoodTagRequest;
}

/** Renames/recolors/redescribes a food tag. Invalidates `['ingredients']` too
 * — the tag's name/color is denormalised onto every tagged food's `tags` chip. */
export function useUpdateFoodTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: UpdateFoodTagVariables) => updateFoodTag(variables.tagId, variables.request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foodTags'] });
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
    },
    onError: (error) => {
      showApiError(error, 'ingredients.tags.updateError');
    },
  });
}

export function useDeleteFoodTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => deleteFoodTag(tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foodTags'] });
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
    },
    onError: (error) => {
      showApiError(error, 'ingredients.tags.deleteError');
    },
  });
}

export interface ReplaceFoodTagAssignmentsVariables {
  foodId: string;
  tagIds: string[];
}

/** Replaces one food's tag assignments for the caller. Not optimistic —
 * mirrors `useAssignClientTags`' own reasoning (the mutation response is the
 * source of truth for what actually got assigned). */
export function useReplaceFoodTagAssignments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: ReplaceFoodTagAssignmentsVariables) =>
      replaceFoodTagAssignments(variables.foodId, variables.tagIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
    },
    onError: (error) => {
      showApiError(error, 'ingredients.tags.assignError');
    },
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
