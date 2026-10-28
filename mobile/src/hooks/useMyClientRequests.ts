import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { MY_REQUESTS_KEY, cancelClientRequest, fetchMyRequests } from '@/api/clientRequests';
import { useAuthStore } from '@/stores/auth';

/** The requests the client has sent to professionals. */
export function useMyClientRequests(enabled = true) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: MY_REQUESTS_KEY,
    queryFn: ({ signal }) => fetchMyRequests(signal),
    enabled: isAuthenticated && enabled,
    retry: 1,
  });
}

/** Withdraws a pending request; the list refetches afterwards. */
export function useCancelClientRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) => cancelClientRequest(publicId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: MY_REQUESTS_KEY });
    },
  });
}
