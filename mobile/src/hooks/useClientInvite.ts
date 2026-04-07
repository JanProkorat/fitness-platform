import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useAuthStore } from '../stores/auth'

export interface TrainerInvite {
  id: string
  trainerId: string
  trainerName: string
  trainerRole: string
  trainerCity: string
  message?: string
}

async function fetchPendingInvite(): Promise<TrainerInvite | null> {
  const { data } = await api.get('/client/invites/pending')
  return data ?? null
}

async function acceptInvite(id: string): Promise<void> {
  await api.post(`/client/invites/${id}/accept`)
}

async function declineInvite(id: string): Promise<void> {
  console.log('[Invite] declining', id)
  const res = await api.post(`/client/invites/${id}/decline`)
  console.log('[Invite] decline response', res.status)
}

export function useClientInvite(enabled: boolean) {
  const queryClient = useQueryClient()
  const refreshProfile = useAuthStore((s) => s.refreshProfile)

  const query = useQuery({
    queryKey: ['client-invite'],
    queryFn: fetchPendingInvite,
    enabled,
    refetchInterval: 30_000,
  })

  const acceptMutation = useMutation({
    mutationFn: acceptInvite,
    onSuccess: async () => {
      queryClient.setQueryData(['client-invite'], null)
      await refreshProfile()
      queryClient.invalidateQueries({ queryKey: ['today-plan'] })
      queryClient.invalidateQueries({ queryKey: ['today-training'] })
      queryClient.invalidateQueries({ queryKey: ['conversation-context'] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  const declineMutation = useMutation({
    mutationFn: declineInvite,
    onSuccess: () => {
      queryClient.setQueryData(['client-invite'], null)
      queryClient.invalidateQueries({ queryKey: ['conversation-context'] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  return {
    invite: query.data ?? null,
    isLoading: query.isLoading,
    accept: acceptMutation.mutate,
    decline: declineMutation.mutate,
  }
}
