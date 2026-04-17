import { useCallback, useRef } from 'react'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { fetchMessages, sendMessage } from '../api/messages'
import type { LocalMessage } from '../types/messages'
import { useAuthStore } from '../stores/auth'

interface MessagesPage {
  items: LocalMessage[]
  cursor: string | null
}

export function useMessages(conversationId: string) {
  const queryClient = useQueryClient()
  const tempIdCounter = useRef(0)

  const query = useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: async ({ pageParam }): Promise<MessagesPage> => {
      const res = await fetchMessages(conversationId, pageParam)
      return { items: res.items ?? [], cursor: res.cursor ?? null }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: MessagesPage) => lastPage.cursor ?? undefined,
  })

  const allMessages = query.data?.pages.flatMap((p) => p.items) ?? []

  const sendMutation = useMutation({
    mutationFn: (text: string) => sendMessage(conversationId, text),
    onMutate: async (text: string) => {
      await queryClient.cancelQueries({ queryKey: ['messages', conversationId] })
      const prev = queryClient.getQueryData<{ pages: MessagesPage[]; pageParams: (string | undefined)[] }>([
        'messages',
        conversationId,
      ])

      const userId = useAuthStore.getState().user?.publicId ?? ''
      const tempId = `temp-${++tempIdCounter.current}`
      const optimistic: LocalMessage = {
        id: tempId,
        senderId: userId,
        text,
        timestamp: new Date().toISOString(),
        isRead: false,
        status: 'sending',
      }

      queryClient.setQueryData<{ pages: MessagesPage[]; pageParams: (string | undefined)[] }>(
        ['messages', conversationId],
        (old) => {
          if (!old) {
            return {
              pages: [{ items: [optimistic], cursor: null }],
              pageParams: [undefined],
            }
          }
          const newPages = [...old.pages]
          newPages[0] = {
            ...newPages[0],
            items: [optimistic, ...newPages[0].items],
          }
          return { ...old, pages: newPages }
        },
      )

      return { prev, tempId }
    },
    onSuccess: (serverMessage, _text, ctx) => {
      queryClient.setQueryData<{ pages: MessagesPage[]; pageParams: (string | undefined)[] }>(
        ['messages', conversationId],
        (old) => {
          if (!old) return old
          const newPages = old.pages.map((page) => ({
            ...page,
            items: page.items.map((m) =>
              m.id === ctx?.tempId ? serverMessage : m,
            ),
          }))
          return { ...old, pages: newPages }
        },
      )
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
    onError: (_err, _text, ctx) => {
      if (ctx?.tempId) {
        queryClient.setQueryData<{ pages: MessagesPage[]; pageParams: (string | undefined)[] }>(
          ['messages', conversationId],
          (old) => {
            if (!old) return old
            const newPages = old.pages.map((page) => ({
              ...page,
              items: page.items.map((m) =>
                m.id === ctx.tempId ? { ...m, status: 'error' as const } : m,
              ),
            }))
            return { ...old, pages: newPages }
          },
        )
      }
    },
  })

  const retry = useCallback(
    (tempId: string) => {
      const msg = allMessages.find((m) => m.id === tempId)
      if (msg?.text) {
        queryClient.setQueryData<{ pages: MessagesPage[]; pageParams: (string | undefined)[] }>(
          ['messages', conversationId],
          (old) => {
            if (!old) return old
            const newPages = old.pages.map((page) => ({
              ...page,
              items: page.items.filter((m) => m.id !== tempId),
            }))
            return { ...old, pages: newPages }
          },
        )
        sendMutation.mutate(msg.text)
      }
    },
    [allMessages, queryClient, conversationId, sendMutation],
  )

  return {
    messages: allMessages,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    send: sendMutation.mutate,
    isSending: sendMutation.isPending,
    retry,
  }
}
