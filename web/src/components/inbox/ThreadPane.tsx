import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Composer from '@/components/inbox/Composer';
import DateSeparator from '@/components/inbox/DateSeparator';
import MessageBubble from '@/components/inbox/MessageBubble';
import ThreadHeader from '@/components/inbox/ThreadHeader';
import TypingIndicator from '@/components/inbox/TypingIndicator';
import { useConversationMessages, useMarkConversationRead, useSendMessage } from '@/hooks/useInboxQueries';
import { invokeHub } from '@/hooks/useSignalR';
import { useAuthStore } from '@/stores/auth';
import type { MessageDto, ParticipantDto } from '@/api/generated';

const SCROLL_TOP_THRESHOLD_PX = 80;
const TYPING_THROTTLE_MS = 2000;

interface Props {
  conversationId: string;
  participant: ParticipantDto;
  showClientPanel: boolean;
  onToggleClientPanel: () => void;
  isOtherPartyTyping: boolean;
}

/** True when `message` starts a new calendar day relative to `previous` (or there is no previous message). */
function startsNewDay(message: MessageDto, previous: MessageDto | undefined): boolean {
  if (!message.timestamp) {
    return false;
  }
  if (!previous?.timestamp) {
    return true;
  }
  return new Date(message.timestamp).toDateString() !== new Date(previous.timestamp).toDateString();
}

/**
 * The thread pane: header, the scrollable message list (oldest at top,
 * newest at bottom, date separators between calendar days, older pages
 * loaded on scroll-up), the typing indicator, and the composer.
 */
export default function ThreadPane({
  conversationId,
  participant,
  showClientPanel,
  onToggleClientPanel,
  isOtherPartyTyping,
}: Props) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastTypingSentAtRef = useRef(0);
  const previousConversationIdRef = useRef<string | undefined>(undefined);

  const messagesQuery = useConversationMessages(conversationId);
  const markReadMutation = useMarkConversationRead();
  const sendMessageMutation = useSendMessage(conversationId);

  const messages = useMemo(
    () => (messagesQuery.data?.pages.flatMap((page) => page.items ?? []) ?? []).reverse(),
    [messagesQuery.data],
  );

  // Mark read once per conversation open, not on every re-render.
  useEffect(() => {
    if (previousConversationIdRef.current !== conversationId) {
      previousConversationIdRef.current = conversationId;
      markReadMutation.mutate(conversationId);
      // Jump to the bottom (newest message) when switching threads.
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only re-runs when the conversation changes, not on every mutate identity change
  }, [conversationId]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el || el.scrollTop > SCROLL_TOP_THRESHOLD_PX) {
      return;
    }
    if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) {
      void messagesQuery.fetchNextPage();
    }
  }

  function handleTyping() {
    const now = Date.now();
    if (now - lastTypingSentAtRef.current < TYPING_THROTTLE_MS) {
      return;
    }
    lastTypingSentAtRef.current = now;
    invokeHub('SendTyping', conversationId);
  }

  const ownInitials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : '';

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <ThreadHeader participant={participant} showClientPanel={showClientPanel} onToggleClientPanel={onToggleClientPanel} />

      <div ref={scrollRef} onScroll={handleScroll} className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
        {messagesQuery.isFetchingNextPage && (
          <p className="py-1 text-center text-caption text-muted-foreground">{t('inbox.thread.loadingOlder')}</p>
        )}
        {messages.map((message, index) => (
          <div key={message.id ?? index} className="flex flex-col gap-2">
            {startsNewDay(message, messages[index - 1]) && message.timestamp && <DateSeparator iso={message.timestamp} />}
            <MessageBubble
              message={message}
              isOwn={Boolean(user) && message.senderId === user?.publicId}
              otherParticipant={participant}
              ownInitials={ownInitials}
              ownAvatarBlobUrl={user?.avatarBlobUrl ?? undefined}
            />
          </div>
        ))}
      </div>

      {isOtherPartyTyping && <TypingIndicator />}

      <Composer
        onSend={(text) => sendMessageMutation.mutate(text)}
        isSending={sendMessageMutation.isPending}
        onTyping={handleTyping}
      />
    </div>
  );
}
