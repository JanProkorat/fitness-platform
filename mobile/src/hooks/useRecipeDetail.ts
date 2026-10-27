import { useQuery } from '@tanstack/react-query';

import { fetchRecipe, recipeQueryKey } from '@/api/nutrition';

/** One recipe; a 404 means it is not in a published week of the client's plan, so it is not retried. */
export function useRecipeDetail(recipeId: string, enabled: boolean) {
  return useQuery({
    queryKey: recipeQueryKey(recipeId),
    queryFn: ({ signal }) => fetchRecipe(recipeId, signal),
    enabled,
    retry: false,
  });
}
