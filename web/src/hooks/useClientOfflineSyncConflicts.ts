import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getClientOfflineSyncConflicts,
  reviewAllOfflineSyncConflicts,
  reviewOfflineSyncConflict,
} from '@/api/offlineSyncConflicts';

/** The backend caps a conflicts page at 100. */
const PLAN_CONFLICTS_PAGE_SIZE = 100;

export const clientOfflineSyncConflictKeys = {
  all: (clientId: string) => ['client-offline-sync-conflicts', clientId] as const,
  list: (clientId: string, pageSize: number) => ['client-offline-sync-conflicts', clientId, pageSize] as const,
  plan: (clientId: string, planId: string) => ['client-offline-sync-conflicts', clientId, 'plan', planId] as const,
};

/** One client's latest offline-sync conflicts; `enabled` is false for viewers without nutrition access. */
export function useClientOfflineSyncConflicts(clientId: string | undefined, pageSize: number, enabled = true) {
  return useQuery({
    queryKey: clientOfflineSyncConflictKeys.list(clientId ?? '', pageSize),
    queryFn: () => getClientOfflineSyncConflicts(clientId!, 1, pageSize),
    enabled: Boolean(clientId) && enabled,
    retry: false,
  });
}

/** Every unreviewed conflict of one client (one max-size page), so none hides behind newer reviewed ones. */
export function useClientUnreviewedOfflineSyncConflicts(clientId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...clientOfflineSyncConflictKeys.all(clientId ?? ''), 'unreviewed'] as const,
    queryFn: () => getClientOfflineSyncConflicts(clientId!, 1, PLAN_CONFLICTS_PAGE_SIZE, { unreviewedOnly: true }),
    enabled: Boolean(clientId) && enabled,
    retry: false,
  });
}

/** The unreviewed conflicts of one client plan, for the plan editor. */
export function useClientPlanOfflineSyncConflicts(clientId: string | undefined, planId: string | undefined) {
  return useQuery({
    queryKey: clientOfflineSyncConflictKeys.plan(clientId ?? '', planId ?? ''),
    queryFn: () =>
      getClientOfflineSyncConflicts(clientId!, 1, PLAN_CONFLICTS_PAGE_SIZE, { planId, unreviewedOnly: true }),
    enabled: Boolean(clientId) && Boolean(planId),
    retry: false,
  });
}

/**
 * Mark-reviewed mutations for one client's plan. Nothing is removed optimistically: the conflict stays
 * until the refetch after a successful call, and a failure leaves it in place.
 */
export function useReviewOfflineSyncConflicts(
  clientId: string,
  planId: string,
  onError: (kind: 'one' | 'all') => void,
) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: clientOfflineSyncConflictKeys.all(clientId) });
  const reviewOne = useMutation({
    mutationFn: (conflictId: string) => reviewOfflineSyncConflict(clientId, conflictId),
    onSuccess: invalidate,
    onError: () => {
      onError('one');
      void invalidate();
    },
  });
  const reviewAll = useMutation({
    mutationFn: () => reviewAllOfflineSyncConflicts(clientId, planId),
    onSuccess: invalidate,
    onError: () => {
      onError('all');
      void invalidate();
    },
  });
  return { reviewOne, reviewAll };
}
