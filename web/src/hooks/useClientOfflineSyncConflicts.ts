import { useQuery } from '@tanstack/react-query';
import { getClientOfflineSyncConflicts } from '@/api/offlineSyncConflicts';

export const clientOfflineSyncConflictKeys = {
  all: (clientId: string) => ['client-offline-sync-conflicts', clientId] as const,
  list: (clientId: string, pageSize: number) => ['client-offline-sync-conflicts', clientId, pageSize] as const,
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
