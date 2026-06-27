import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { cn } from '@/lib/cn';
import { MessageBubble } from '@/components/domain';
import { useAuthStore } from '@/stores/auth';
import { invokeHub } from '@/hooks/useSignalR';
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  markConversationRead,
  startConversation,
  type ConversationDto,
  type MessageDto,
} from '@/api/messages';

// ── Avatar color palette ──
const AVATAR_COLORS = [
  '#0b6e99', '#ad5700', '#0f7b6c', '#6940a5',
  '#c9a84c', '#d44d2c', '#2d7d9a', '#8854d0',
];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Dnes';
  if (diffDays === 1) return 'Včera';
  return d.toLocaleDateString('cs', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatConvTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return formatTime(iso);
  if (diffDays === 1) return 'Včera';
  if (diffDays < 7) return d.toLocaleDateString('cs', { weekday: 'short' });
  return d.toLocaleDateString('cs', { day: 'numeric', month: 'short' });
}

// ── Conversation Item ──
function ConversationItem({
  conv,
  isActive,
  onClick,
}: {
  conv: ConversationDto;
  isActive: boolean;
  onClick: () => void;
}) {
  const color = colorForName(conv.participant.name);
  const hasUnread = conv.unreadCount > 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer transition-colors border-b border-border relative',
        isActive ? 'bg-bg-active' : 'hover:bg-bg-hover',
      )}
    >
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-[13px] font-semibold text-white relative"
        style={{ backgroundColor: color }}
      >
        {conv.participant.initials}
        {conv.participant.online && (
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green border-2 border-bg2" />
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-text truncate">
          {conv.participant.name}
        </div>
        <div
          className={cn(
            'text-xs truncate mt-px',
            hasUnread ? 'text-text font-medium' : 'text-text3',
          )}
        >
          {conv.lastMessageIsOwn ? 'Vy: ' : ''}
          {conv.lastMessage}
        </div>
      </div>

      {/* Right column */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <div className="text-[11px] text-text3">
          {formatConvTime(conv.lastMessageAt)}
        </div>
        {hasUnread && (
          <div className="min-w-[18px] h-[18px] rounded-full bg-accent text-white text-[11px] font-semibold flex items-center justify-center px-1">
            {conv.unreadCount}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──
export default function MessagesPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.publicId);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const openedClientRef = useRef<string | null>(null);

  // ── Conversations ──
  const { data: rawConversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: fetchConversations,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
  const conversations = useMemo(
    () => (Array.isArray(rawConversations) ? rawConversations : []),
    [rawConversations]
  );

  // Start or open conversation when ?clientId= is present
  const clientIdParam = searchParams.get('clientId');

  const startConvMutation = useMutation({
    mutationFn: startConversation,
    onSuccess: async (conv) => {
      await queryClient.refetchQueries({ queryKey: ['conversations'] });
      setActiveConvId(String(conv.id));
      navigate('/messages', { replace: true });
    },
    onError: (err) => {
      console.error('[Messages] Failed to start conversation:', err);
      navigate('/messages', { replace: true });
    },
  });

  useEffect(() => {
    if (!clientIdParam || openedClientRef.current === clientIdParam) return;
    openedClientRef.current = clientIdParam;
    startConvMutation.mutate(clientIdParam);
  }, [clientIdParam]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select first conversation (when no clientId param) — must run in an
  // effect to avoid enqueuing a state update during render.
  useEffect(() => {
    if (!activeConvId && conversations.length > 0 && !clientIdParam) {
      setActiveConvId(conversations[0].id);
    }
  }, [conversations, activeConvId, clientIdParam]);

  const activeConv = conversations.find((c) => c.id === activeConvId);

  // Filter + sort conversations
  const filteredConvs = useMemo(() => {
    let list = conversations;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.participant.name.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });
  }, [conversations, search]);

  // ── Messages ──
  const {
    data: messagesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['messages', activeConvId],
    queryFn: ({ pageParam }) => fetchMessages(activeConvId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
    enabled: !!activeConvId,
    refetchInterval: 5_000,
  });

  const messages = useMemo(
    () => (messagesData?.pages.flatMap((p) => p.items) ?? []).slice().reverse(),
    [messagesData],
  );

  // Scroll to bottom on new messages or conversation switch
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages.length, activeConvId]);

  // Mark as read when opening a conversation
  useEffect(() => {
    if (activeConvId && activeConv && activeConv.unreadCount > 0) {
      markConversationRead(activeConvId).then(() => {
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      });
    }
  }, [activeConvId]);

  // ── Send message ──
  const sendMutation = useMutation({
    mutationFn: (text: string) => sendMessage(activeConvId!, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', activeConvId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const handleSend = useCallback(() => {
    const text = messageInput.trim();
    if (!text || !activeConvId) return;
    sendMutation.mutate(text);
    setMessageInput('');
  }, [messageInput, activeConvId, sendMutation]);

  // ── Typing indicator ──
  const typingData = queryClient.getQueryData<{ isTyping: boolean }>(['typing', activeConvId]);
  const peerIsTyping = typingData?.isTyping ?? false;

  // Force re-render when typing state changes
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const unsub = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query?.queryKey?.[0] === 'typing' && event?.query?.queryKey?.[1] === activeConvId) {
        forceUpdate((n) => n + 1);
      }
    });
    return () => unsub();
  }, [activeConvId, queryClient]);

  const lastTypingSentRef = useRef(0);
  const handleTyping = useCallback(() => {
    if (!activeConvId) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;
    invokeHub('SendTyping', activeConvId);
  }, [activeConvId]);

  // ── Group messages by date ──
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: MessageDto[] }[] = [];
    let lastDate = '';
    for (const msg of messages) {
      const date = new Date(msg.timestamp).toDateString();
      if (date !== lastDate) {
        groups.push({ date: formatDate(msg.timestamp), messages: [msg] });
        lastDate = date;
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    }
    return groups;
  }, [messages]);

  const avatarColor = activeConv ? colorForName(activeConv.participant.name) : '#0b6e99';

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Conversation panel ── */}
      <div className="w-[280px] shrink-0 border-r border-border flex flex-col bg-bg2 overflow-hidden">
        <div className="px-3.5 pt-3 pb-2 border-b border-border shrink-0">
          <div className="text-[15px] font-semibold text-text mb-2">Zprávy</div>
          <div className="flex items-center gap-1.5 bg-bg3 rounded-md px-2.5 py-[5px]">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="text-text4 shrink-0"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              placeholder="Hledat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 border-none outline-none bg-transparent text-[13px] text-text font-[inherit] placeholder:text-text4"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredConvs.map((conv) => (
            <ConversationItem
              key={conv.id}
              conv={conv}
              isActive={conv.id === activeConvId}
              onClick={() => setActiveConvId(conv.id)}
            />
          ))}
          {filteredConvs.length === 0 && (
            <div className="p-6 text-center text-[13px] text-text3">
              {search ? 'Žádné konverzace nenalezeny' : 'Zatím žádné zprávy'}
            </div>
          )}
        </div>
      </div>

      {/* ── Chat panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-bg">
        {activeConv ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border shrink-0">
              <div
                className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold text-white"
                style={{ backgroundColor: avatarColor }}
              >
                {activeConv.participant.initials}
              </div>
              <div>
                <div className="text-sm font-semibold text-text">
                  {activeConv.participant.name}
                </div>
                <div className="flex items-center gap-1 mt-px text-xs text-text3">
                  {activeConv.participant.online ? (
                    <>
                      <span className="w-[7px] h-[7px] rounded-full bg-green inline-block" />
                      Online
                    </>
                  ) : (
                    'Offline'
                  )}
                </div>
              </div>
              <div className="ml-auto flex gap-1">
                <button
                  className="w-7 h-7 rounded flex items-center justify-center text-[13px] text-text3 hover:bg-bg-hover hover:text-text transition-colors"
                  title="Profil klienta"
                >
                  👤
                </button>
                <button
                  className="w-7 h-7 rounded flex items-center justify-center text-[13px] text-text3 hover:bg-bg-hover hover:text-text transition-colors"
                  title="Více"
                >
                  ···
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-0.5">
              {/* Load more */}
              {hasNextPage && (
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="text-xs text-text3 hover:text-text mb-2 self-center"
                >
                  {isFetchingNextPage ? 'Načítání...' : 'Načíst starší zprávy'}
                </button>
              )}

              {groupedMessages.map((group, gi) => (
                <div key={gi}>
                  <div className="text-center text-[11px] text-text4 font-medium my-2.5">
                    {group.date}
                  </div>
                  {group.messages.map((msg, mi) => {
                    const isOwn = msg.senderId === userId;
                    const nextMsg = group.messages[mi + 1];
                    const showAvatar = !nextMsg || nextMsg.senderId !== msg.senderId;

                    return (
                      <MessageBubble
                        key={msg.id}
                        text={msg.text}
                        time={formatTime(msg.timestamp)}
                        isOwn={isOwn}
                        initials={activeConv.participant.initials}
                        avatarColor={avatarColor}
                        showAvatar={showAvatar}
                      />
                    );
                  })}
                </div>
              ))}
              {peerIsTyping && (
                <div className="flex items-center gap-1 px-4 py-1.5">
                  <div className="flex items-center gap-[3px] bg-bg2 rounded-[18px] rounded-bl-[5px] px-3.5 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                    <span className="w-[7px] h-[7px] rounded-full bg-text4 animate-bounce [animation-delay:0ms]" />
                    <span className="w-[7px] h-[7px] rounded-full bg-text4 animate-bounce [animation-delay:200ms]" />
                    <span className="w-[7px] h-[7px] rounded-full bg-text4 animate-bounce [animation-delay:400ms]" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <div className="px-3.5 py-2.5 border-t border-border flex items-end gap-2 shrink-0">
              <div className="flex-1 flex items-center gap-1.5 bg-bg2 border border-border-md rounded-lg px-3 py-[7px] transition-colors focus-within:border-border-hv">
                <button
                  className="w-5 h-5 flex items-center justify-center text-text3 hover:text-text text-sm shrink-0"
                  title="Připojit plán"
                >
                  📎
                </button>
                <input
                  value={messageInput}
                  onChange={(e) => { setMessageInput(e.target.value); handleTyping(); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={`Napsat ${activeConv.participant.name.split(' ')[0]}...`}
                  className="flex-1 border-none outline-none bg-transparent text-[13px] text-text font-[inherit] placeholder:text-text4"
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!messageInput.trim() || sendMutation.isPending}
                className="h-8 px-3.5 rounded-md bg-accent text-white border-none text-[13px] font-medium font-[inherit] cursor-pointer transition-colors hover:bg-[#b8933d] disabled:bg-bg3 disabled:text-text3 disabled:cursor-default shrink-0"
              >
                Odeslat
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-text3 gap-2">
            <div className="text-4xl opacity-30">💬</div>
            <div className="text-[13px]">Vyberte konverzaci</div>
          </div>
        )}
      </div>
    </div>
  );
}
