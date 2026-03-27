import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/cn';
import { Button, SearchInput } from '@/components/ui';
import { MessageBubble } from '@/components/domain';

interface Conversation {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  lastMessage: string;
  time: string;
  unread: number;
}

interface Message {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  text: string;
  time: string;
  isOwn: boolean;
}

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: '1',
    name: 'Petra Horakova',
    initials: 'PH',
    avatarColor: 'bg-red-bg text-red',
    lastMessage: 'Splneno! 💪',
    time: '14:32',
    unread: 0,
  },
  {
    id: '2',
    name: 'Martin Cervenka',
    initials: 'MC',
    avatarColor: 'bg-blue-bg text-blue',
    lastMessage: 'Omlouvam se za vypadek...',
    time: '12:10',
    unread: 1,
  },
  {
    id: '3',
    name: 'Jana Kovarova',
    initials: 'JK',
    avatarColor: 'bg-green-bg text-green',
    lastMessage: 'Dekuji za plan!',
    time: 'vce',
    unread: 0,
  },
  {
    id: '4',
    name: 'Tomas Dvorak',
    initials: 'TD',
    avatarColor: 'bg-purple-bg text-purple',
    lastMessage: 'Mohu zmenit trenink na patek?',
    time: 'vce',
    unread: 2,
  },
];

const MOCK_MESSAGES: Record<string, Message[]> = {
  '1': [
    { id: 'm1', name: 'Petra Horakova', initials: 'PH', avatarColor: 'bg-red-bg text-red', text: 'Ahoj Marku! Novy treninkovy plan vypada skvele 💪', time: '13:48', isOwn: false },
    { id: 'm2', name: 'Marek Trener', initials: 'MT', avatarColor: 'bg-bg3 text-text', text: 'Diky Petro! Jak se citis po prvnim treninku?', time: '13:52', isOwn: true },
    { id: 'm3', name: 'Petra Horakova', initials: 'PH', avatarColor: 'bg-red-bg text-red', text: 'Super! Mam otazku ohledne jidelnicku – 80 g ryze je sucha nebo uvarena?', time: '14:11', isOwn: false },
    { id: 'm4', name: 'Marek Trener', initials: 'MT', avatarColor: 'bg-bg3 text-text', text: 'Vzdy sucha gramaz 😊 Uvarena vazi priblizne 2,5× vice.', time: '14:22', isOwn: true },
    { id: 'm5', name: 'Petra Horakova', initials: 'PH', avatarColor: 'bg-red-bg text-red', text: 'Splneno! 💪', time: '14:32', isOwn: false },
  ],
  '2': [
    { id: 'm6', name: 'Martin Cervenka', initials: 'MC', avatarColor: 'bg-blue-bg text-blue', text: 'Ahoj, tento tyden jsem nestihl 2 treninky.', time: '11:20', isOwn: false },
    { id: 'm7', name: 'Marek Trener', initials: 'MT', avatarColor: 'bg-bg3 text-text', text: 'Nevadi, zkus to dohnat o vikendu. Poslu ti upraveny plan.', time: '11:45', isOwn: true },
    { id: 'm8', name: 'Martin Cervenka', initials: 'MC', avatarColor: 'bg-blue-bg text-blue', text: 'Omlouvam se za vypadek...', time: '12:10', isOwn: false },
  ],
  '3': [
    { id: 'm9', name: 'Jana Kovarova', initials: 'JK', avatarColor: 'bg-green-bg text-green', text: 'Dekuji za plan!', time: 'vce 16:30', isOwn: false },
  ],
  '4': [
    { id: 'm10', name: 'Tomas Dvorak', initials: 'TD', avatarColor: 'bg-purple-bg text-purple', text: 'Mohu zmenit trenink na patek?', time: 'vce 09:15', isOwn: false },
    { id: 'm11', name: 'Tomas Dvorak', initials: 'TD', avatarColor: 'bg-purple-bg text-purple', text: 'A jeste bych chtel pridat cardio.', time: 'vce 09:16', isOwn: false },
  ],
};

export default function MessagesPage() {
  const [activeConversation, setActiveConversation] = useState('1');
  const [conversationSearch, setConversationSearch] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const listRef = useRef<HTMLDivElement>(null);

  const activeConv = MOCK_CONVERSATIONS.find((c) => c.id === activeConversation);
  const activeMessages = messages[activeConversation] || [];

  // Filter conversations by search
  const filteredConversations = MOCK_CONVERSATIONS.filter((c) =>
    c.name.toLowerCase().includes(conversationSearch.toLowerCase()),
  );

  // Auto-scroll to bottom
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [activeMessages.length, activeConversation]);

  const handleSend = () => {
    const text = messageInput.trim();
    if (!text) return;

    const now = new Date();
    const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newMsg: Message = {
      id: `m-${Date.now()}`,
      name: 'Marek Trener',
      initials: 'MT',
      avatarColor: 'bg-bg3 text-text',
      text,
      time,
      isOwn: true,
    };

    setMessages((prev) => ({
      ...prev,
      [activeConversation]: [...(prev[activeConversation] || []), newMsg],
    }));
    setMessageInput('');
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel - Conversation list */}
      <div className="w-[280px] shrink-0 border-r border-border flex flex-col bg-bg">
        <div className="p-3 border-b border-border">
          <SearchInput
            placeholder="Hledat konverzace..."
            value={conversationSearch}
            onChange={(e) => setConversationSearch(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setActiveConversation(conv.id)}
              className={cn(
                'flex items-start gap-2.5 px-3 py-2.5 cursor-pointer transition-colors duration-100',
                conv.id === activeConversation
                  ? 'bg-bg-active'
                  : 'hover:bg-bg-hover',
              )}
            >
              {/* Avatar */}
              <div
                className={cn(
                  'w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[11px] font-semibold mt-0.5',
                  conv.avatarColor,
                )}
              >
                {conv.initials}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[13px] font-medium text-text truncate">
                    {conv.name}
                  </span>
                  <span className="text-[11px] text-text3 shrink-0 ml-2">
                    {conv.time}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-text3 truncate flex-1">
                    {conv.lastMessage}
                  </span>
                  {conv.unread > 0 && (
                    <span className="shrink-0 w-[18px] h-[18px] rounded-full bg-accent text-[10px] font-semibold text-bg flex items-center justify-center">
                      {conv.unread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - Message thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        {activeConv && (
          <div className="px-5 py-3 border-b border-border flex items-center gap-3 shrink-0">
            <div
              className={cn(
                'w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[11px] font-semibold',
                activeConv.avatarColor,
              )}
            >
              {activeConv.initials}
            </div>
            <div>
              <div className="text-[15px] font-semibold text-text">
                {activeConv.name}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-green inline-block" />
                <span className="text-[12px] text-text3">online</span>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-3 py-2"
        >
          <div className="flex flex-col gap-0.5">
            {activeMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                name={msg.name}
                initials={msg.initials}
                avatarColor={msg.avatarColor}
                time={msg.time}
                text={msg.text}
                isOwn={msg.isOwn}
              />
            ))}
          </div>
        </div>

        {/* Input area */}
        <div className="px-4 py-3 border-t border-border flex gap-2 shrink-0">
          <div className="flex-1 flex items-center gap-2 border border-border-md rounded-md py-1.5 px-2.5 bg-bg transition-colors duration-150 focus-within:border-border-hv">
            <span className="text-text3 text-sm">✎</span>
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={activeConv ? `Napsat zpravu ${activeConv.name.split(' ')[0]}...` : 'Napsat zpravu...'}
              className="border-none outline-none bg-transparent text-[13px] text-text flex-1 font-[inherit] placeholder:text-text3"
            />
          </div>
          <Button variant="primary" onClick={handleSend}>
            Odeslat
          </Button>
        </div>
      </div>
    </div>
  );
}
