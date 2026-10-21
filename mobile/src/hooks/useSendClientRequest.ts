import { useMutation, useQueryClient } from '@tanstack/react-query';

import { classifySendRequestError, sendClientRequest } from '@/api/clientRequests';
import { CONVERSATIONS_QUERY_KEY } from '@/api/conversations';
import { coachProfileQueryKey } from '@/api/professionals';
import { PROFILE_QUERY_KEY } from '@/api/profile';

/** Sends a request to one coach, then refreshes whatever the outcome made stale. */
export function useSendClientRequest(professionalPublicId: string) {
  const queryClient = useQueryClient();
  const refreshCoach = () =>
    queryClient.invalidateQueries({ queryKey: coachProfileQueryKey(professionalPublicId) });

  return useMutation({
    mutationFn: (input: { message: string; shareHistory: boolean }) =>
      sendClientRequest({ professionalPublicId, ...input }),
    onSuccess: () => {
      // The new request conversation is not pushed to the client.
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
      return refreshCoach();
    },
    onError: (error) => {
      switch (classifySendRequestError(error)) {
        case 'alreadyLinked':
          void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
          void refreshCoach();
          break;
        case 'notAccepting':
        case 'alreadyPending':
        case 'notFound':
          void refreshCoach();
          break;
      }
    },
  });
}
