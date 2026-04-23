import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { startConversation, sendMessage } from '../api/messages'
import { getMyRequests, type ClientRequestDto } from '../api/professionals'
import { getCollaborations, endCollaboration, type CollaborationDto } from '../api/profile'
import { useAuthStore, type ActiveCollaborator, type PendingRequest } from '../stores/auth'
import { Toast } from '../lib/toast'

function collabToActiveCollaborator(c: CollaborationDto): ActiveCollaborator {
  // Generated types make all fields optional; use nullish coalescing to guard
  // against undefined at runtime (backend always sends these fields).
  const name = c.professionalName ?? ''
  return {
    id: (c.professionalPublicId ?? '').toString(),
    name,
    initials: name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase(),
    role: c.role ?? '',
    city: c.professionalCity ?? '',
    since: typeof c.since === 'string' ? c.since : new Date(c.since ?? 0).toISOString(),
    avatarColor: '',
    avatarBg: '',
    avatarImageUrl: c.avatarBlobUrl ?? null,
  }
}

function requestToPending(r: ClientRequestDto): PendingRequest {
  const name = r.professionalName ?? ''
  const parts = name.split(' ')
  return {
    id: r.publicId ?? '',
    trainerId: r.professionalPublicId ?? '',
    name,
    initials: parts.map((w) => w[0]).join('').toUpperCase(),
    role: '',
    city: '',
    avatarColor: '',
    avatarBg: '',
    sentAt: r.sentAt ?? '',
  }
}

export function useCollaboration() {
  const queryClient = useQueryClient()
  const store = useAuthStore()

  // Fetch active collaborations
  const collabQuery = useQuery({
    queryKey: ['collaborations'],
    queryFn: getCollaborations,
    enabled: store.isAuthenticated,
  })

  // Fetch pending requests
  const requestsQuery = useQuery({
    queryKey: ['my-requests'],
    queryFn: getMyRequests,
    enabled: store.isAuthenticated,
  })

  // Sync collaborations into auth store
  useEffect(() => {
    if (!collabQuery.data) return
    const collabs = collabQuery.data
    const trainerCollab = collabs.find((c) => c.role === 'Trainer')
    const coachCollab = collabs.find((c) => c.role === 'Nutritionist')
    store.setTrainer(trainerCollab ? collabToActiveCollaborator(trainerCollab) : null)
    store.setCoach(coachCollab ? collabToActiveCollaborator(coachCollab) : null)
  }, [collabQuery.data])

  // Sync pending requests into auth store
  useEffect(() => {
    if (!requestsQuery.data) return
    const pending = requestsQuery.data
      .filter((r) => r.status === 'Pending')
      .map(requestToPending)
    store.setPendingRequests(pending)
  }, [requestsQuery.data])

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['collaborations'] })
    queryClient.invalidateQueries({ queryKey: ['my-requests'] })
  }

  const acceptInviteMutation = useMutation({
    mutationFn: (id: string) => api.post(`/client/invites/${id}/accept`),
    onSuccess: () => {
      invalidateAll()
      store.refreshProfile()
      Toast.show('Invitation accepted')
    },
  })

  const declineInviteMutation = useMutation({
    mutationFn: (id: string) => api.post(`/client/invites/${id}/decline`),
    onSuccess: () => {
      store.setPendingInvite(null)
      invalidateAll()
      Toast.show('Invitation declined')
    },
  })

  const endTrainerMutation = useMutation({
    mutationFn: () => {
      const collab = collabQuery.data?.find((c) => c.role === 'Trainer')
      if (!collab) throw new Error('No trainer collaboration found')
      return endCollaboration((collab.publicId ?? '').toString())
    },
    onMutate: () => {
      const prev = { trainer: store.trainer, hasTrainer: store.hasTrainer }
      store.setTrainer(null)
      return prev
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) store.setTrainer(ctx.trainer)
    },
    onSettled: () => {
      invalidateAll()
      store.refreshProfile()
    },
  })

  const endCoachMutation = useMutation({
    mutationFn: () => {
      const collab = collabQuery.data?.find((c) => c.role === 'Nutritionist')
      if (!collab) throw new Error('No coach collaboration found')
      return endCollaboration((collab.publicId ?? '').toString())
    },
    onMutate: () => {
      const prev = { coach: store.coach, hasCoach: store.hasCoach }
      store.setCoach(null)
      return prev
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) store.setCoach(ctx.coach)
    },
    onSettled: () => {
      invalidateAll()
      store.refreshProfile()
    },
  })

  const sendRequestMutation = useMutation({
    mutationFn: async ({ trainerId, message }: { trainerId: string; message?: string }) => {
      await api.post('/client/requests', { professionalPublicId: trainerId, message })
      // Send the introduction as a chat message
      if (message) {
        try {
          const conversation = await startConversation(trainerId)
          const conversationId = conversation.id ?? ''
          if (conversationId) {
            await sendMessage(conversationId, message)
          }
        } catch {
          // Request was sent — chat message is a best-effort addition
        }
      }
    },
    onMutate: ({ trainerId }) => {
      // Optimistic update so button changes immediately
      const optimistic: PendingRequest = {
        id: `temp-${trainerId}`,
        trainerId,
        name: '',
        initials: '',
        role: '',
        city: '',
        avatarColor: '',
        avatarBg: '',
        sentAt: new Date().toISOString(),
      }
      store.addPendingRequest(optimistic)
    },
    onSuccess: () => {
      invalidateAll()
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      Toast.show('Request sent')
    },
    onError: (_err, { trainerId }) => {
      store.removePendingRequest(`temp-${trainerId}`)
    },
  })

  const cancelRequestMutation = useMutation({
    mutationFn: (requestId: string) =>
      api.delete(`/client/requests/${requestId}`),
    onMutate: (requestId) => {
      const prev = store.pendingRequests
      // Remove both the real and any temp entry for this trainer
      const request = prev.find((r) => r.id === requestId)
      store.setPendingRequests(
        prev.filter((r) => r.id !== requestId && (!request || r.trainerId !== request.trainerId)),
      )
      return prev
    },
    onError: (_err, _vars, prev) => {
      if (prev) store.setPendingRequests(prev)
    },
    onSuccess: () => {
      invalidateAll()
      Toast.show('Request cancelled')
    },
  })

  return {
    isLoading: collabQuery.isLoading || requestsQuery.isLoading,
    refetch: () => { collabQuery.refetch(); requestsQuery.refetch() },
    acceptInvite: acceptInviteMutation.mutate,
    declineInvite: declineInviteMutation.mutate,
    endTrainerCollab: endTrainerMutation.mutate,
    endCoachCollab: endCoachMutation.mutate,
    sendRequest: (trainerId: string, message?: string) =>
      sendRequestMutation.mutate({ trainerId, message }),
    cancelRequest: cancelRequestMutation.mutate,
    isSendingRequest: sendRequestMutation.isPending,
  }
}
