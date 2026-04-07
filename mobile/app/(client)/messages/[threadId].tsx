import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/hooks/useTheme'
import { useMessages } from '../../../src/hooks/useMessages'
import { useTypingStatus } from '../../../src/hooks/useTypingStatus'
import { useAuthStore } from '../../../src/stores/auth'
import api from '../../../src/api/client'
import { Toast } from '@/lib/toast'
import { fetchConversations, fetchConversationContext, markConversationRead } from '../../../src/api/messages'
import { ChatHeader } from '@/components/messages/ChatHeader'
import { ChatInputBar } from '@/components/messages/ChatInputBar'
import { MessageBubble } from '@/components/messages/MessageBubble'
import { ContextBanner } from '@/components/messages/ContextBanner'
import { FormerTrainerBanner } from '@/components/messages/FormerTrainerBanner'
import { TypingIndicator } from '@/components/messages/TypingIndicator'
import { DateSeparator } from '@/components/messages/DateSeparator'
import type { Message } from '../../../src/types/messages'

export default function ChatScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>()
  const router = useRouter()
  const colors = useTheme()
  const insets = useSafeAreaInsets()
  const userId = useAuthStore((s) => s.user?.publicId)

  // Find conversation participant info
  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => fetchConversations(false),
    staleTime: 30_000,
  })

  const conversation = conversations?.find((c) => c.id === threadId)
  const participant = conversation?.participant
  const [showFormerBanner, setShowFormerBanner] = useState(true)

  // Context banner
  const { data: context } = useQuery({
    queryKey: ['conversation-context', threadId],
    queryFn: () => fetchConversationContext(threadId!),
    enabled: !!threadId,
  })

  const queryClient = useQueryClient()
  const refreshProfile = useAuthStore((s) => s.refreshProfile)

  const acceptMutation = useMutation({
    mutationFn: (inviteId: string) => api.post(`/client/invites/${inviteId}/accept`),
    onSuccess: async () => {
      Toast.show(`You and ${participant?.name} are now connected`)
      queryClient.invalidateQueries({ queryKey: ['conversation-context'] })
      queryClient.invalidateQueries({ queryKey: ['client-invite'] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      await refreshProfile()
    },
  })

  const declineMutation = useMutation({
    mutationFn: (inviteId: string) => api.post(`/client/invites/${inviteId}/decline`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-context'] })
      queryClient.invalidateQueries({ queryKey: ['client-invite'] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  // Messages
  const {
    messages,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    send,
    retry,
  } = useMessages(threadId!)

  // Mark messages as read when viewing this conversation
  useEffect(() => {
    if (threadId && messages.length > 0) {
      markConversationRead(threadId)
        .then(() => {
          console.log('[Chat] markConversationRead succeeded, invalidating conversations')
          return queryClient.invalidateQueries({ queryKey: ['conversations'] })
        })
        .catch((err) => console.warn('[Chat] markConversationRead failed:', err))
    }
  }, [threadId, messages.length, queryClient])

  // Typing status
  const { isTyping, notifyTyping } = useTypingStatus(threadId!)

  // Check if a message is the last in a consecutive group from the same sender
  const isLastInGroup = useCallback(
    (index: number) => {
      if (index === 0) return true
      const current = messages[index]
      const next = messages[index - 1]
      return current.senderId !== next.senderId
    },
    [messages],
  )

  // Check if we need a date separator before this message
  const needsDateSep = useCallback(
    (index: number) => {
      if (index === messages.length - 1) return true
      const current = new Date(messages[index].timestamp)
      const prev = new Date(messages[index + 1].timestamp)
      return current.toDateString() !== prev.toDateString()
    },
    [messages],
  )

  const renderItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const isOwn = item.senderId === userId
      const showAvatar = !isOwn && isLastInGroup(index)

      return (
        <View>
          {needsDateSep(index) && (
            <DateSeparator timestamp={item.timestamp} />
          )}
          <MessageBubble
            message={item}
            isOwn={isOwn}
            showAvatar={showAvatar}
            participantName={participant?.name}
            onRetry={retry}
          />
        </View>
      )
    },
    [userId, isLastInGroup, needsDateSep, participant, retry],
  )

  const listHeader = useMemo(() => {
    if (!isTyping) return null
    return <TypingIndicator />
  }, [isTyping])

  const listFooter = useMemo(() => {
    if (!isFetchingNextPage) return null
    return (
      <ActivityIndicator
        color={colors.gold}
        style={{ paddingVertical: 12 }}
      />
    )
  }, [isFetchingNextPage, colors.gold])

  const handleSend = useCallback(
    (text: string) => {
      send(text)
    },
    [send],
  )

  if (!participant) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.gold} style={{ marginTop: 100 }} />
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Fixed header */}
      <View style={{ paddingTop: insets.top }}>
        <ChatHeader
          participant={participant}
          onBack={() => router.navigate('/(client)/messages' as never)}
          onInfoPress={() => {}}
        />
      </View>

      {/* Former trainer warning banner */}
      {conversation?.isFormer && showFormerBanner && (
        <FormerTrainerBanner
          trainerName={participant?.name ?? ''}
          onShow={() => setShowFormerBanner(false)}
          onIgnore={() => {
            if (threadId) {
              markConversationRead(threadId).catch(() => {})
            }
            router.back()
          }}
        />
      )}

      {/* Fixed invite/context banner */}
      {context?.type === 'invite' && context.inviteId && (
        <ContextBanner
          icon={context.icon}
          title={context.title}
          sub={context.sub}
          actionLabel={context.actionLabel}
          onAction={() => {}}
          onAccept={() => acceptMutation.mutate(context.inviteId!)}
          onDecline={() => declineMutation.mutate(context.inviteId!)}
        />
      )}
      {context && context.type !== 'invite' && (
        <ContextBanner
          icon={context.icon}
          title={context.title}
          sub={context.sub}
          actionLabel={context.actionLabel}
          onAction={() => router.push(context.actionRoute as never)}
        />
      )}

      {/* Scrollable message list — flex: 1 fills remaining space */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        inverted
        style={styles.messageList}
        contentContainerStyle={{ paddingVertical: 8, flexGrow: 1 }}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage()
          }
        }}
        onEndReachedThreshold={0.3}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      />

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.gold} />
        </View>
      )}

      {/* Fixed input bar */}
      <ChatInputBar
        onSend={handleSend}
        onAttachPress={() => {}}
        onTyping={notifyTyping}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messageList: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
