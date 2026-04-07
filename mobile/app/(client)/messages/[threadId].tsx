import React, { useCallback, useMemo, useState } from 'react'
import {
  View,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  LayoutChangeEvent,
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
import { fetchConversations, fetchConversationContext } from '../../../src/api/messages'
import { ChatHeader } from '@/components/messages/ChatHeader'
import { ChatInputBar } from '@/components/messages/ChatInputBar'
import { MessageBubble } from '@/components/messages/MessageBubble'
import { ContextBanner } from '@/components/messages/ContextBanner'
import { TypingIndicator } from '@/components/messages/TypingIndicator'
import { DateSeparator } from '@/components/messages/DateSeparator'
import type { Message } from '../../../src/types/messages'

export default function ChatScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>()
  const router = useRouter()
  const colors = useTheme()
  const insets = useSafeAreaInsets()
  const userId = useAuthStore((s) => s.user?.publicId)

  const [headerHeight, setHeaderHeight] = useState(0)
  const [inputHeight, setInputHeight] = useState(0)

  // Find conversation participant info
  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: fetchConversations,
    staleTime: 30_000,
  })

  const conversation = conversations?.find((c) => c.id === threadId)
  const participant = conversation?.participant

  // Context banner
  const { data: context } = useQuery({
    queryKey: ['conversation-context', threadId],
    queryFn: () => fetchConversationContext(threadId!),
    enabled: !!threadId,
  })

  const queryClient = useQueryClient()
  const refreshProfile = useAuthStore((s) => s.refreshProfile)

  const [bannerHeight, setBannerHeight] = useState(0)

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

  // Typing status
  const { isTyping, notifyTyping } = useTypingStatus(threadId!)

  const handleHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    setHeaderHeight(e.nativeEvent.layout.height)
  }, [])

  const handleInputLayout = useCallback((e: LayoutChangeEvent) => {
    setInputHeight(e.nativeEvent.layout.height)
  }, [])

  // Check if a message is the last in a consecutive group from the same sender
  const isLastInGroup = useCallback(
    (index: number) => {
      // Inverted list: index 0 = newest. "Next" visually below = index - 1
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
      // Inverted list: older messages are at higher indices
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
    [userId, isLastInGroup, needsDateSep, participant, retry, router],
  )

  // List header = bottom of inverted list (newest messages area)
  const listHeader = useMemo(() => {
    if (!isTyping) return null
    return <TypingIndicator />
  }, [isTyping])

  // List footer = top of inverted list (oldest messages area)
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
      <View
        onLayout={handleHeaderLayout}
        style={{ paddingTop: insets.top }}
      >
        <ChatHeader
          participant={participant}
          onBack={() => router.back()}
          onInfoPress={() => {}}
        />
      </View>

      {/* Fixed invite/context banner between header and message list */}
      <View onLayout={(e) => setBannerHeight(e.nativeEvent.layout.height)}>
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
      </View>

      {/* Scrollable message list */}
      {headerHeight > 0 && (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          inverted
          style={[
            styles.messageList,
            {
              top: headerHeight + bannerHeight,
              bottom: inputHeight,
            },
          ]}
          contentContainerStyle={{ paddingVertical: 8 }}
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
      )}

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.gold} />
        </View>
      )}

      {/* Fixed input bar */}
      <View onLayout={handleInputLayout}>
        <ChatInputBar
          onSend={handleSend}
          onAttachPress={() => {}}
          onTyping={notifyTyping}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messageList: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachWrap: {
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  attachOwn: {
    alignItems: 'flex-end',
  },
})
