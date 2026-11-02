import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clientFormsKey, getClientForms, markClientFormSeen } from '@/api/questionnaires';
import { getErrorStatus } from '@/lib/api-errors';

/** The forms of one client. A 404 (no live link) is final, so it is not retried. */
export function useClientForms(clientId: string) {
  return useQuery({
    queryKey: clientFormsKey(clientId),
    queryFn: ({ signal }) => getClientForms(clientId, signal),
    enabled: Boolean(clientId),
    retry: (failureCount, error) => getErrorStatus(error) !== 404 && failureCount < 1,
  });
}

/** Marks a form as seen and refreshes the list. A 409 (not submitted) and a 404 (link ended) are ignored. */
export function useMarkClientFormSeen(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (responsePublicId: string) => markClientFormSeen(clientId, responsePublicId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: clientFormsKey(clientId) }),
    // The popover already shows the answers, so a failed mark-seen is not worth a toast.
    onError: () => undefined,
  });
}
