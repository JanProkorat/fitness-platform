import { useQuery } from '@tanstack/react-query';

import { getErrorStatus } from '@/api/errors';
import { coachProfileQueryKey, fetchCoachProfile } from '@/api/professionals';

/** A coach's public profile; a 404 (hidden or unknown coach) is not retried. */
export function useCoachProfile(publicId: string) {
  return useQuery({
    queryKey: coachProfileQueryKey(publicId),
    queryFn: ({ signal }) => fetchCoachProfile(publicId, signal),
    enabled: publicId.length > 0,
    retry: (failureCount, error) => getErrorStatus(error) !== 404 && failureCount < 1,
  });
}
