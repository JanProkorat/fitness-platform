import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  searchFoods,
  createFood,
  updateFood,
  deleteFood,
  requestFoodImageUploadUrl,
  confirmFoodImage,
  removeFoodImage,
} from '@/api/foods';
import {
  getFoodTags,
  createFoodTag,
  updateFoodTag,
  deleteFoodTag,
  replaceFoodTagAssignments,
  type CreateFoodTagRequest,
  type UpdateFoodTagRequest,
} from '@/api/food-tags';
import { FoodSortDirection, FoodSortField } from '@/api/food-types';
import type { CreateFoodRequest, UpdateFoodRequest } from '@/api/food-types';
import type { UploadFoodImageUrlRequest } from '@/api/generated';
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
  const ownersKey = [...filters.owners].sort().join(',');

  return useQuery({
    queryKey: [
      'ingredients',
      'list',
      {
        search: filters.search,
        categoriesKey,
        tagsKey,
        ownersKey,
        sortBy: filters.sortBy,
        sortDir: filters.sortDir,
        page: filters.page,
        pageSize: filters.pageSize,
      },
    ],
    queryFn: () =>
      searchFoods({
        q: filters.search || undefined,
        categories: filters.categories,
        tagIds: filters.tags,
        owners: filters.owners,
        page: filters.page,
        pageSize: filters.pageSize,
        // A cleared sort (`sort=none` in the URL, filters.sortBy === null)
        // must still request a deterministic order — newest first — rather
        // than fall back to the backend's own no-sortBy default (Name
        // ascending). This is a wire-request mapping only: the URL keeps
        // `sort=none` (see useIngredientListParams' CLEARED_SORT), and
        // DateCreated never becomes a clickable column header.
        sortBy: filters.sortBy ?? FoodSortField.DateCreated,
        sortDir: filters.sortBy ? filters.sortDir : FoodSortDirection.Descending,
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

/**
 * Per-food cache-buster for the picture `<img src>` (#1140). The main
 * picture's blob key is deterministic (`foods/{id}.jpg`), so replacing it
 * keeps the SAME url — without this, the browser can keep showing the
 * stale cached bytes after a successful replace. This is not server data:
 * a plain counter living in its own query-cache entry (deliberately NOT
 * namespaced under `['ingredients']`, so the broad
 * `invalidateQueries({ queryKey: ['ingredients'] })` calls below never
 * touch it), bumped only after a confirmed upload/replace/remove. Both the
 * drawer and the table read the same counter for the same food, so a
 * replace is visible in both places at once.
 */
function imageVersionKey(foodId: string) {
  return ['foodImageVersion', foodId] as const;
}

/** Reads the current cache-buster counter for one food's picture. Returns 0
 * until the first successful upload/replace/remove bumps it. */
export function useFoodImageVersion(foodId: string | undefined): number {
  const query = useQuery({
    queryKey: imageVersionKey(foodId ?? 'none'),
    queryFn: () => 0,
    enabled: false,
    initialData: 0,
    staleTime: Infinity,
  });
  return query.data;
}

function bumpFoodImageVersion(queryClient: QueryClient, foodId: string): void {
  queryClient.setQueryData<number>(imageVersionKey(foodId), (previous) => (previous ?? 0) + 1);
}

/** Requests a pre-signed upload URL for a food's main picture (owner only).
 * The caller PUTs the file to `uploadUrl` directly (never through this
 * mutation) and only then confirms via `useConfirmFoodImage`. */
export function useRequestFoodImageUploadUrl() {
  return useMutation({
    mutationFn: (variables: { foodId: string; request: UploadFoodImageUrlRequest }) =>
      requestFoodImageUploadUrl(variables.foodId, 'main', variables.request),
  });
}

export interface ConfirmFoodImageVariables {
  foodId: string;
  blobUrl: string;
}

/**
 * Confirms a completed main-picture upload. Call only after the browser's
 * own PUT to the pre-signed URL has already succeeded — see
 * `IngredientPictureField`'s upload flow. Bumps the cache-buster and
 * invalidates the ingredients list/detail queries so the new picture shows
 * up everywhere.
 */
export function useConfirmFoodImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: ConfirmFoodImageVariables) =>
      confirmFoodImage(variables.foodId, 'main', variables.blobUrl),
    onSuccess: (_data, variables) => {
      bumpFoodImageVersion(queryClient, variables.foodId);
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
    },
  });
}

/** Removes a food's main picture (owner only), after an explicit confirm step. */
export function useRemoveFoodImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (foodId: string) => removeFoodImage(foodId),
    onSuccess: (_data, foodId) => {
      bumpFoodImageVersion(queryClient, foodId);
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      showSuccess('ingredients.picture.removeSuccess');
    },
    onError: (error) => {
      showApiError(error, 'ingredients.picture.removeError');
    },
  });
}
