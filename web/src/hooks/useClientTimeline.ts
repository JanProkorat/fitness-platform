import { useQuery } from '@tanstack/react-query';
import { getClientTimeline, type ClientTimelineResponse } from '@/api/timeline';

/**
 * Shared default limit for a client's activity timeline. ClientDetailPage
 * (overview "top PR" derivation) and AktivitaTab (activity list, before the
 * user clicks "load more") previously fetched the same endpoint with two
 * different limits (50 vs 30) under two differently-shaped query keys,
 * so the two never shared a cache entry even when both were mounted at
 * once (#687). Both now default to this value so the initial fetch is
 * shared; AktivitaTab's "load more" still grows past it under its own key.
 */
export const CLIENT_TIMELINE_DEFAULT_LIMIT = 50;

export const clientTimelineKeys = {
  detail: (clientId: string, limit: number = CLIENT_TIMELINE_DEFAULT_LIMIT) =>
    ['client-timeline', clientId, limit] as const,
};

interface UseClientTimelineOptions {
  limit?: number;
  enabled?: boolean;
}

export function useClientTimeline(
  clientId: string | undefined,
  { limit = CLIENT_TIMELINE_DEFAULT_LIMIT, enabled = true }: UseClientTimelineOptions = {},
) {
  return useQuery<ClientTimelineResponse>({
    queryKey: clientTimelineKeys.detail(clientId ?? '', limit),
    queryFn: () => getClientTimeline(clientId!, limit),
    enabled: Boolean(clientId) && enabled,
    retry: false,
  });
}
