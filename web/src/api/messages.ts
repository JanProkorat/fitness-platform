import api from '@/lib/api';

export interface ConversationDto {
  id: string;
  participant: {
    id: string;
    name: string;
    initials: string;
    online: boolean;
  };
  lastMessage: string;
  lastMessageAt: string;
  lastMessageIsOwn: boolean;
  unreadCount: number;
}

export interface MessageDto {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  isRead: boolean;
}

interface MessagesResponse {
  items: MessageDto[];
  cursor: string | null;
}

export async function fetchConversations(): Promise<ConversationDto[]> {
  const { data } = await api.get('/conversations');
  return data;
}

export async function fetchMessages(
  conversationId: string,
  cursor?: string,
): Promise<MessagesResponse> {
  const { data } = await api.get(`/conversations/${conversationId}/messages`, {
    params: { cursor, limit: 50 },
  });
  return data;
}

export async function sendMessage(
  conversationId: string,
  text: string,
): Promise<MessageDto> {
  const { data } = await api.post(`/conversations/${conversationId}/messages`, {
    text,
  });
  return data;
}

export async function markConversationRead(
  conversationId: string,
): Promise<void> {
  await api.post(`/conversations/${conversationId}/read`, {});
}

export async function startConversation(
  participantId: string,
): Promise<ConversationDto> {
  const { data } = await api.post('/conversations', { participantId });
  return data;
}
