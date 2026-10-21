import { useQuery } from '@tanstack/react-query';

import { fetchInviteCoach, inviteCoachQueryKey } from '@/api/invites';

/** The inviting coach's public profile. A failure just means the detail shows less. */
export function useInviteCoach(coachPublicId: string | undefined) {
  return useQuery({
    queryKey: inviteCoachQueryKey(coachPublicId ?? ''),
    queryFn: ({ signal }) => fetchInviteCoach(coachPublicId ?? '', signal),
    enabled: Boolean(coachPublicId),
    retry: false,
  });
}
