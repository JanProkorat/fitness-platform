import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { CHECK_IN_HISTORY_QUERY_KEY, fetchCheckInHistoryPage } from '@/api/checkIns';
import type { CheckInHistoryItem } from '@/api/checkIns';
import { useAuthStore } from '@/stores/auth';

/** The signed-in client's check-ins, newest first, loaded page by page. */
export function useCheckInHistory() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const query = useInfiniteQuery({
    queryKey: CHECK_IN_HISTORY_QUERY_KEY,
    queryFn: ({ pageParam, signal }) => fetchCheckInHistoryPage(pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: isAuthenticated,
    retry: 1,
  });

  const items = useMemo<CheckInHistoryItem[]>(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  return {
    items,
    isPending: query.isPending,
    /** The first page failed; nothing can be shown. */
    isError: query.isError && query.data === undefined,
    /** A later page failed; the rows already loaded stay on screen. */
    isNextPageError: query.isError && query.data !== undefined,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: () => void query.fetchNextPage(),
    refetch: () => void query.refetch(),
  };
}
