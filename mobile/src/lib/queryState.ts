import { isNetworkError } from '@/api/errors';

type QueryLike = {
  isError: boolean;
  data: unknown;
  error: unknown;
};

/** A failed query with nothing saved to show; a failed refetch keeps its cached data on screen. */
export function showsError(query: QueryLike): boolean {
  return query.isError && query.data === undefined;
}

/**
 * Nothing saved for this query and the request got no HTTP response at all.
 * A 4xx or 5xx answer is a real error and is not offline-empty.
 */
export function isOfflineEmpty(query: QueryLike): boolean {
  return query.data === undefined && query.error != null && isNetworkError(query.error);
}
