import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { CONVERSATIONS_QUERY_KEY } from '@/api/conversations';
import { getErrorStatus } from '@/api/errors';
import { ChatMessageKind } from '@/api/generated';
import { ChatEventCard } from '@/components/messages/ChatEventCard';
import { ChatHeader } from '@/components/messages/ChatHeader';
import { Composer } from '@/components/messages/Composer';
import { MessageBubble } from '@/components/messages/MessageBubble';
import { buildChatItems } from '@/components/messages/chatItems';
import type { ChatItem } from '@/components/messages/chatItems';
import { daySeparator } from '@/components/messages/format';
import { Text } from '@/components/Text';
import { useConversationMessages, useRefreshConversationMessages } from '@/hooks/useConversationMessages';
import { useConversations } from '@/hooks/useConversations';
import { useMarkConversationRead } from '@/hooks/useMarkConversationRead';
import { useSendMessage } from '@/hooks/useSendMessage';
import { useRealtimeEvent, useRealtimeReconnected } from '@/realtime/useRealtimeEvent';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type NewMessagePayload = { conversationId?: string };

export default function ChatScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets);
  const queryClient = useQueryClient();
  const { id = '' } = useLocalSearchParams<{ id: string }>();

  const conversations = useConversations();
  const messagesQuery = useConversationMessages(id);
  const refreshMessages = useRefreshConversationMessages(id);
  const markRead = useMarkConversationRead(id);
  const send = useSendMessage(id);
  const [draft, setDraft] = useState('');

  const conversation = conversations.data?.find((candidate) => candidate.id === id);
  const participantId = conversation?.participant?.id;
  const messages = messagesQuery.data;

  // The open chat re-reads the thread rather than appending: the push carries no event status.
  const refreshOpenChat = useCallback(() => {
    void refreshMessages();
  }, [refreshMessages]);
  useRealtimeEvent<NewMessagePayload>('newmessage', (payload) => {
    if (payload?.conversationId?.toLowerCase() === id.toLowerCase()) refreshOpenChat();
  });
  useRealtimeEvent('invitationcancelled', refreshOpenChat);
  useRealtimeEvent('clientrequestaccepted', refreshOpenChat);
  useRealtimeEvent('clientrequestrejected', refreshOpenChat);
  useRealtimeEvent('clientrequestcancelled', refreshOpenChat);
  useRealtimeReconnected(refreshOpenChat);

  // Mark the chat read on open, and again whenever a refetch brings a newer unread incoming message.
  const unreadIncomingId = useMemo(() => {
    if (!participantId || !messages) return undefined;
    return messages.find(
      (message) =>
        message.kind !== ChatMessageKind.Event && message.senderId === participantId && message.isRead === false,
    )?.id;
  }, [messages, participantId]);
  const markedId = useRef<string | undefined>(undefined);
  const { mutate: markConversationRead } = markRead;
  useEffect(() => {
    if (!unreadIncomingId || markedId.current === unreadIncomingId) return;
    markedId.current = unreadIncomingId;
    markConversationRead(undefined, {
      // Let the next refetch try again when the request did not land.
      onError: () => {
        markedId.current = undefined;
      },
    });
  }, [unreadIncomingId, markConversationRead]);

  const items = useMemo(() => buildChatItems(messages ?? []), [messages]);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const refreshAfterAnswer = useCallback(() => {
    void refreshMessages();
    void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
  }, [queryClient, refreshMessages]);

  const onSend = () => {
    const text = draft.trim();
    if (!text || send.isPending) return;
    send.mutate(text, {
      // Clear the field only when the user has not typed on since pressing send.
      onSuccess: () => setDraft((current) => (current.trim() === text ? '' : current)),
    });
  };

  const notFound =
    getErrorStatus(messagesQuery.error) === 404 || (conversations.isSuccess && !conversation);

  if (notFound) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text variant="subtitle">{t('chat.notFound.title')}</Text>
        <Text variant="bodyLarge" color="muted" style={styles.centerText}>
          {t('chat.notFound.body')}
        </Text>
        <Pressable accessibilityRole="button" onPress={leave}>
          <Text variant="link" color="accent">
            {t('chat.notFound.back')}
          </Text>
        </Pressable>
      </View>
    );
  }

  const loadFailed = messagesQuery.isError || conversations.isError;
  const loading = !loadFailed && (!conversation || messages === undefined);
  const readOnly = conversation?.isFormer === true;
  const locked = conversation?.isSendLocked === true;

  const renderItem = ({ item }: { item: ChatItem }) => {
    const own = item.message.senderId !== participantId;
    return (
      <View style={styles.item}>
        {item.dayStart ? (
          <Text variant="caption" color="muted" style={styles.separator}>
            {daySeparator(t, i18n.language, item.message.timestamp)}
          </Text>
        ) : null}
        {item.kind === 'card' ? (
          conversation ? (
            <ChatEventCard
              conversation={conversation}
              message={item.message}
              settledAt={item.settledAt}
              own={own}
              onAnswered={refreshAfterAnswer}
            />
          ) : null
        ) : (
          <MessageBubble text={item.message.text ?? ''} own={own} />
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <ChatHeader
          name={conversation?.participant?.name}
          roles={conversation?.participant?.roles}
          onBack={leave}
        />
      </View>

      {loadFailed ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void messagesQuery.refetch();
            void conversations.refetch();
          }}
          style={styles.center}
        >
          <Text variant="bodyLarge" color="muted" style={styles.centerText}>
            {t('chat.loadError')}
          </Text>
        </Pressable>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : (
        <FlatList
          // Items are newest first; inverting keeps the latest message at the bottom.
          inverted
          data={items}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          ListEmptyComponent={
            <Text variant="bodyLarge" color="muted" style={[styles.centerText, styles.empty]}>
              {t('chat.empty')}
            </Text>
          }
        />
      )}

      <View style={styles.footer}>
        {readOnly || locked ? (
          <Text variant="bodySmall" color="muted" style={styles.centerText}>
            {readOnly ? t('chat.readOnly') : t('chat.locked')}
          </Text>
        ) : (
          <Composer
            draft={draft}
            onChangeDraft={setDraft}
            onSend={onSend}
            sending={send.isPending}
            failed={send.isError}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (theme: Theme, insets: EdgeInsets) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.ground,
    },
    header: {
      paddingTop: insets.top + theme.spacing.xs,
      paddingHorizontal: theme.spacing.xxl,
      paddingBottom: theme.spacing.md,
    },
    list: {
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.xxl,
      paddingVertical: theme.spacing.md,
    },
    item: {
      gap: theme.spacing.md,
    },
    separator: {
      alignSelf: 'center',
      paddingTop: theme.spacing.xs,
    },
    footer: {
      paddingTop: theme.spacing.md,
      paddingHorizontal: theme.spacing.xxl,
      paddingBottom: Math.max(insets.bottom, theme.spacing.xl),
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.md,
      padding: theme.spacing.xxl,
    },
    centerText: {
      textAlign: 'center',
    },
    empty: {
      // The list is inverted, so the empty note is flipped back upright.
      transform: [{ scaleY: -1 }],
    },
  });
