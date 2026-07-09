import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useAcceptInvite } from './useAcceptInvite'

export interface TrainerInvite {
  id: string
  trainerId: string
  trainerName: string
  trainerRole: string
  trainerCity: string
  message?: string
}

async function fetchPendingInvite(): Promise<TrainerInvite | null> {
  const resp = await api.get('/client/invites/pending', {
    // Accept 204 No Content as a valid "no invite" response
    validateStatus: (s: number) => s === 200 || s === 204,
  })
  // 204 = no invite, 200 with empty/string body = legacy null response
  if (resp.status === 204 || !resp.data || typeof resp.data === 'string') return null
  return resp.data as TrainerInvite
}

async function declineInvite(id: string): Promise<void> {
  await api.post(`/client/invites/${id}/decline`)
}

export function useClientInvite(enabled: boolean) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['client-invite'],
    queryFn: fetchPendingInvite,
    enabled,
    staleTime: 0,              // always refetch on mount / screen focus
    // Poll every 30s ONLY when we don't have invite data yet.
    // Once data arrives (from SignalR setQueryData or API), stop polling
    // so the API's "not found" response doesn't overwrite SignalR-set data.
    refetchInterval: (q) => (q.state.data ? false : 30_000),
  })

  // Shared accept-invite mutation (#605) — owns the union invalidation set
  // (today-plan/today-training/conversation-context/conversations/
  // collaborations/my-requests/client-invite + refreshProfile). This site
  // additionally clears the invite banner optimistically so it disappears
  // immediately rather than waiting on the client-invite refetch.
  const acceptMutation = useAcceptInvite()

  const declineMutation = useMutation({
    mutationFn: declineInvite,
    onSuccess: () => {
      queryClient.setQueryData(['client-invite'], null)
      queryClient.invalidateQueries({ queryKey: ['conversation-context'] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  // Log fetch errors in dev so they're visible in Metro console
  if (__DEV__ && query.error) {
    console.warn('[useClientInvite] fetch error:', query.error)
  }

  return {
    invite: query.data ?? null,
    isLoading: query.isLoading,
    accept: (id: string) =>
      acceptMutation.mutate(id, {
        onSuccess: () => queryClient.setQueryData(['client-invite'], null),
      }),
    decline: declineMutation.mutate,
  }
}
