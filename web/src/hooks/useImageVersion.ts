import { useQuery, type QueryClient } from '@tanstack/react-query';

/**
 * Per-picture cache-buster for an `<img src>`. A food's main picture keeps
 * the SAME url when replaced (its blob key is deterministic), so the browser
 * can keep showing stale cached bytes; recipe picture keys are not
 * deterministic, but the same bump is harmless there. This is not server data: a plain counter living
 * in its own query-cache entry (deliberately outside the list/detail key
 * namespaces, so broad invalidations never touch it), bumped only after a
 * confirmed upload/replace/remove. `cacheKey` namespaces the entity, e.g.
 * `food:<id>` or `recipe:<id>`.
 */
function imageVersionKey(cacheKey: string) {
  return ['imageVersion', cacheKey] as const;
}

/** Reads the current cache-buster counter. Returns 0 until the first bump. */
export function useImageVersion(cacheKey: string | undefined): number {
  const query = useQuery({
    queryKey: imageVersionKey(cacheKey ?? 'none'),
    queryFn: () => 0,
    enabled: false,
    initialData: 0,
    staleTime: Infinity,
  });
  return query.data;
}

export function bumpImageVersion(queryClient: QueryClient, cacheKey: string): void {
  queryClient.setQueryData<number>(imageVersionKey(cacheKey), (previous) => (previous ?? 0) + 1);
}
