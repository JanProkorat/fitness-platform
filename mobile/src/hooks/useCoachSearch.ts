import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { COACH_QUERY_KEY, fetchCoachPage, topSpecializations } from '@/api/professionals';
import type { CoachSearchFilters, CoachSummary } from '@/api/professionals';

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/** Paged coach search plus the specialty chips offered for the loaded results. */
export function useCoachSearch(filters: CoachSearchFilters) {
  const query = useInfiniteQuery({
    queryKey: [...COACH_QUERY_KEY, 'search', filters] as const,
    queryFn: ({ pageParam, signal }) => fetchCoachPage(filters, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);
      return last.items.length > 0 && loaded < last.totalCount ? last.page + 1 : undefined;
    },
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const items = useMemo<CoachSummary[]>(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );
  const totalCount = query.data?.pages[0]?.totalCount ?? 0;

  // The chips come from results that no specialty narrowed; picking one must not remove the others.
  const [pool, setPool] = useState<string[]>([]);
  if (query.isSuccess && !query.isPlaceholderData && filters.specialization === undefined) {
    const next = topSpecializations(items);
    if (!sameList(next, pool)) setPool(next);
  }
  const specialties =
    filters.specialization !== undefined && !pool.includes(filters.specialization)
      ? [filters.specialization, ...pool]
      : pool;

  return {
    items,
    totalCount,
    specialties,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    isRefetching: query.isFetching && !query.isFetchingNextPage && !query.isPending,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: () => void query.fetchNextPage(),
    refetch: () => void query.refetch(),
  };
}
