import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useAuthStore } from '../stores/auth'

/**
 * Shared accept-invite mutation for `POST /client/invites/{id}/accept`.
 *
 * Before #605, three call sites (Discover invite detail via
 * `useCollaboration`, the client-invite banner via `useClientInvite`, and
 * the inline mutation in the chat thread screen) each invalidated a
 * different subset of query keys, so accepting from one screen left stale
 * data in another (most notably the Today tab's plan/session queries).
 *
 * This hook is the single source of truth for what a successful accept
 * invalidates — the union of everything any of the three call sites needs:
 *   - ['today-plan'], ['today-training']   — Today tab reflects the new plan/session
 *   - ['conversation-context'], ['conversations'] — chat UI reflects the new collaborator
 *   - ['collaborations'], ['my-requests']  — collaboration/profile screens
 *   - ['client-invite']                    — clears the pending-invite banner
 *   - refreshProfile()                     — hasActiveLink / linkedRoles on the user object
 *
 * Call sites keep their own navigation (`router.replace`, `router.back`) and
 * any call-site-specific UI feedback (toast copy, optimistic setQueryData)
 * by passing an `onSuccess` to `.mutate(id, { onSuccess })` — React Query
 * runs this hook's `onSuccess` first, then the call-site one.
 */
export function useAcceptInvite() {
  const queryClient = useQueryClient()
  const refreshProfile = useAuthStore((s) => s.refreshProfile)

  return useMutation({
    mutationFn: (inviteId: string) => api.post(`/client/invites/${inviteId}/accept`),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['today-plan'] })
      queryClient.invalidateQueries({ queryKey: ['today-training'] })
      queryClient.invalidateQueries({ queryKey: ['conversation-context'] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['collaborations'] })
      queryClient.invalidateQueries({ queryKey: ['my-requests'] })
      queryClient.invalidateQueries({ queryKey: ['client-invite'] })
      await refreshProfile()
    },
  })
}
