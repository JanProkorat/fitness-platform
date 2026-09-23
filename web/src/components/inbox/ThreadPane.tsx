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
/** How close to the bottom counts as "already reading the latest" — below this, an
 * arriving/sent message auto-scrolls into view; above it, the reader is left alone. */
const SCROLL_BOTTOM_THRESHOLD_PX = 120;
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
  /** The conversation id for which the one-time "jump to newest" has already run. */
  const initializedConversationIdRef = useRef<string | undefined>(undefined);
  /** Id of the newest loaded message, used to tell "a message was appended" apart
   * from "an older page was prepended" (both change the `messages` array). */
  const lastMessageIdRef = useRef<string | undefined>(undefined);
  /** Whether the reader was scrolled near the bottom the last time they scrolled —
   * gates auto-scroll on arrival/send so it never yanks someone reading history. */
  const isNearBottomRef = useRef(true);
  /** Set right before `fetchNextPage()` for an older page; restored once that page
   * lands so the viewport doesn't jump (invariant: scrollHeight - scrollTop). */
  const pendingOlderPageAnchorRef = useRef<number | null>(null);
  const wasFetchingNextPageRef = useRef(false);

  const messagesQuery = useConversationMessages(conversationId);
  const markReadMutation = useMarkConversationRead();
  const sendMessageMutation = useSendMessage(conversationId);

  const messages = useMemo(
    () => (messagesQuery.data?.pages.flatMap((page) => page.items ?? []) ?? []).reverse(),
    [messagesQuery.data],
  );

  // Mark read once per conversation open, not on every re-render. The actual
  // "jump to newest" scroll happens below, once the first page has data —
  // doing it here raced the fetch and left a cold-cache thread stranded at
  // its oldest loaded message (#1099 review finding).
  useEffect(() => {
    if (previousConversationIdRef.current !== conversationId) {
      previousConversationIdRef.current = conversationId;
      markReadMutation.mutate(conversationId);
      lastMessageIdRef.current = undefined;
      isNearBottomRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only re-runs when the conversation changes, not on every mutate identity change
  }, [conversationId]);

  // Scroll to the newest message once the first page for this conversation has
  // rendered, and again whenever a genuinely new message is appended (a realtime
  // push or a just-sent message) while the reader was already near the bottom.
  // An older page loaded via scroll-up never touches the newest message's id, so
  // it doesn't trigger this — that case is handled by the anchor-restore effect below.
  useEffect(() => {
    if (messages.length === 0) {
      return;
    }
    const newestMessageId = messages[messages.length - 1]?.id;
    const isFirstLoadForThisConversation = initializedConversationIdRef.current !== conversationId;
    const isNewestMessageChanged = newestMessageId !== lastMessageIdRef.current;
    lastMessageIdRef.current = newestMessageId;

    if (!isFirstLoadForThisConversation && !isNewestMessageChanged) {
      return;
    }

    if (isFirstLoadForThisConversation || isNearBottomRef.current) {
      initializedConversationIdRef.current = conversationId;
      isNearBottomRef.current = true;
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: isFirstLoadForThisConversation ? 'auto' : 'smooth',
        });
      });
    }
  }, [messages, conversationId]);

  // Restore the scroll anchor once an older page (loaded via scroll-up) lands,
  // so the message the reader was looking at doesn't jump under them.
  useEffect(() => {
    const justFinishedLoadingOlderPage = wasFetchingNextPageRef.current && !messagesQuery.isFetchingNextPage;
    wasFetchingNextPageRef.current = messagesQuery.isFetchingNextPage;

    if (!justFinishedLoadingOlderPage || pendingOlderPageAnchorRef.current === null) {
      return;
    }
    const anchor = pendingOlderPageAnchorRef.current;
    pendingOlderPageAnchorRef.current = null;
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight - anchor;
      }
    });
  }, [messagesQuery.isFetchingNextPage]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_BOTTOM_THRESHOLD_PX;

    if (el.scrollTop > SCROLL_TOP_THRESHOLD_PX) {
      return;
    }
    if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) {
      pendingOlderPageAnchorRef.current = el.scrollHeight - el.scrollTop;
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

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        data-testid="thread-message-list"
        className="flex flex-1 flex-col gap-2 overflow-y-auto p-4"
      >
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
        conversationId={conversationId}
        onSend={(payload) => sendMessageMutation.mutate(payload)}
        isSending={sendMessageMutation.isPending}
        onTyping={handleTyping}
      />
    </div>
  );
}
